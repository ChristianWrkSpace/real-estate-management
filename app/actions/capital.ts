"use server";

import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";
import { runCapitalAnalysis, type CapitalAnalysis } from "@/lib/ai/agents/ledger-capital";

/**
 * Run a fresh capital-structure analysis for the single property and
 * persist a summary row to ai_logs for the audit trail. The
 * deterministic numbers are always returned; the AI narrative is
 * best-effort.
 */
export async function analyzeCapitalStructure(opts: {
  includeNarrative?: boolean;
} = {}): Promise<{ success: boolean; analysis: CapitalAnalysis | null; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: property, error } = await supabase
    .from("properties")
    .select("id, name, current_value, mortgage_balance, interest_rate, purchase_price, purchase_date")
    .limit(1)
    .maybeSingle();
  if (error || !property) {
    return { success: false, analysis: null, error: error?.message ?? "No property found" };
  }

  const startOfYear = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().split("T")[0];

  const { data: txs } = await supabase
    .from("transactions")
    .select("amount, type")
    .eq("property_id", property.id)
    .gte("date", startOfYear)
    .lte("date", today);

  const income = (txs ?? [])
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expenses = (txs ?? [])
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const yearStart = new Date(startOfYear).getTime();
  const monthsElapsed = Math.max(
    1,
    Math.round(((Date.now() - yearStart) / (1000 * 60 * 60 * 24 * 365.25)) * 12)
  );

  const analysis = await runCapitalAnalysis(
    {
      propertyName: property.name,
      currentValue: numberOrNull(property.current_value),
      mortgageBalance: numberOrNull(property.mortgage_balance),
      interestRatePct: numberOrNull(property.interest_rate),
      purchasePrice: numberOrNull(property.purchase_price),
      purchaseDate: property.purchase_date as string | null,
      noiYtd: income - expenses,
      monthsElapsedThisYear: monthsElapsed,
    },
    { includeNarrative: opts.includeNarrative ?? true }
  );

  // Audit log (best-effort)
  try {
    await admin.from("ai_logs").insert({
      agent_name: "ledger-capital",
      task_description: "capital_structure_analysis",
      model_used: analysis.narrative_model ?? "deterministic-only",
      token_cost: analysis.narrative_cost_usd,
      status: "succeeded",
      output_data: { property_id: property.id, ...analysis } as unknown as Record<string, unknown>,
    });
  } catch {
    /* swallow */
  }

  return { success: true, analysis };
}

export async function getLatestCapitalAnalysis(): Promise<CapitalAnalysis | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_logs")
    .select("output_data")
    .eq("agent_name", "ledger-capital")
    .eq("task_description", "capital_structure_analysis")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.output_data as unknown as CapitalAnalysis) ?? null;
}

function numberOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
