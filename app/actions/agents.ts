"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";
import { runFastAgent, runFrontierAgent } from "@/lib/ai/orchestrator";

// ─────────────────────────────────────────────────────────────────────────────
// Ledger Agent (FAST) — categorize free-form transaction text
// ─────────────────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES = ["rent", "late_fees", "other_income"] as const;
const EXPENSE_CATEGORIES = [
  "mortgage",
  "insurance",
  "utilities",
  "maintenance",
  "property_tax",
  "pest_control",
  "landscaping",
  "management",
  "other_expense",
] as const;

type CategorizeResult = {
  type: "income" | "expense";
  category: string;
  amount: number | null;
  date: string | null;
  description: string;
  confidence: number;
};

export async function categorizeTransaction(
  rawText: string
): Promise<{ success: boolean; data?: CategorizeResult; error?: string }> {
  if (!rawText?.trim()) {
    return { success: false, error: "Empty input" };
  }

  const systemPrompt = `You are the Ledger Agent for a single-family-style 4-plex P&L system.
Extract a single transaction from the user's text and return JSON ONLY (no prose, no fences).
Schema:
{
  "type": "income" | "expense",
  "category": string,        // one of the allowed categories for the type
  "amount": number | null,   // USD, positive
  "date": "YYYY-MM-DD" | null,
  "description": string,     // short, plain English
  "confidence": number       // 0..1
}
Allowed income categories: ${INCOME_CATEGORIES.join(", ")}
Allowed expense categories: ${EXPENSE_CATEGORIES.join(", ")}`;

  const result = await runFastAgent<CategorizeResult>({
    agent: "ledger",
    task: "categorize_transaction",
    systemPrompt,
    userPrompt: rawText.slice(0, 4000),
    maxTokens: 300,
  });

  if (!result.success) return { success: false, error: result.error || "AI call failed" };
  if (!result.parsed) {
    return { success: false, error: "Ledger did not return valid JSON" };
  }
  return { success: true, data: result.parsed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Argus Financial Agent (FRONTIER) — full P&L audit
// ─────────────────────────────────────────────────────────────────────────────

export type FinancialAuditReport = {
  propertyName: string;
  asOf: string;
  gross_income_ytd: number;
  total_expenses_ytd: number;
  noi_ytd: number;
  monthly_avg_rent: number;
  cap_rate_pct: number | null; // NOI / current_value
  cash_on_cash_pct: number | null;
  property_value: number | null;
  mortgage_balance: number | null;
  equity: number | null;
  narrative: string; // Dorsey-style: tight, declarative, one paragraph
  flags: string[];
  model: string;
  cost_usd: number;
  log_id?: string;
};

const ARGUS_SYSTEM = `You are Argus, the financial audit agent for PropMan OS — a small-property P&L system.
Style: Jack Dorsey — declarative, terse, no filler, no headers, no bullet lists.
Output one paragraph (<=120 words). State the bottom line first. Mention NOI and Cap Rate in numbers.
Call out at most TWO risks or anomalies if any. End with one concrete recommendation.
Return JSON ONLY (no fences, no preamble) with shape:
{ "narrative": string, "flags": string[] }`;

export async function runFinancialAudit(): Promise<{
  success: boolean;
  report?: FinancialAuditReport;
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();

  const { data: properties } = await supabase
    .from("properties")
    .select("id, name, current_value, mortgage_balance, purchase_price")
    .limit(1);
  const property = properties?.[0];
  if (!property) return { success: false, error: "No property found" };

  const startOfYear = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().split("T")[0];

  const { data: txs } = await supabase
    .from("transactions")
    .select("amount, date, type, category, description")
    .eq("property_id", property.id)
    .gte("date", startOfYear)
    .lte("date", today);

  const transactions = txs ?? [];

  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const noi = income - expenses;

  // Annualize NOI based on how much of the year has elapsed
  const yearStart = new Date(startOfYear).getTime();
  const yearMs = 365 * 24 * 3600 * 1000;
  const elapsed = Math.max(1, Date.now() - yearStart);
  const yearFraction = Math.min(1, elapsed / yearMs);
  const annualizedNoi = noi / Math.max(yearFraction, 1 / 12);

  const value = property.current_value ? Number(property.current_value) : null;
  const mortgage = property.mortgage_balance ? Number(property.mortgage_balance) : null;
  const purchasePrice = property.purchase_price ? Number(property.purchase_price) : null;

  const equity = value != null && mortgage != null ? value - mortgage : null;
  const capRatePct = value && value > 0 ? (annualizedNoi / value) * 100 : null;
  const cashInvested = purchasePrice && mortgage ? purchasePrice - mortgage : equity;
  const cocPct =
    cashInvested && cashInvested > 0 ? (annualizedNoi / cashInvested) * 100 : null;

  const monthlyAvgRent =
    transactions.filter((t) => t.category === "rent").reduce((s, t) => s + Number(t.amount), 0) /
    Math.max(1, Math.round(yearFraction * 12));

  const summaryForModel = {
    property: property.name,
    as_of: today,
    ytd_income: income,
    ytd_expenses: expenses,
    ytd_noi: noi,
    annualized_noi: annualizedNoi,
    current_value: value,
    mortgage_balance: mortgage,
    equity,
    cap_rate_pct: capRatePct,
    cash_on_cash_pct: cocPct,
    monthly_avg_rent: monthlyAvgRent,
    transaction_count: transactions.length,
    categories: transactions.reduce<Record<string, number>>((acc, t) => {
      const key = `${t.type}:${t.category}`;
      acc[key] = (acc[key] ?? 0) + Number(t.amount);
      return acc;
    }, {}),
  };

  const result = await runFrontierAgent<{ narrative: string; flags: string[] }>({
    agent: "argus",
    task: "financial_audit_ytd",
    systemPrompt: ARGUS_SYSTEM,
    userPrompt: `Here are the YTD financials. Produce the JSON.\n\n${JSON.stringify(
      summaryForModel,
      null,
      2
    )}`,
    maxTokens: 600,
    storeRaw: true,
  });

  const narrative =
    result.parsed?.narrative ??
    (result.success
      ? result.content.trim().slice(0, 600)
      : "Audit unavailable — AI call failed.");
  const flags = result.parsed?.flags ?? [];

  const report: FinancialAuditReport = {
    propertyName: property.name,
    asOf: today,
    gross_income_ytd: income,
    total_expenses_ytd: expenses,
    noi_ytd: noi,
    monthly_avg_rent: Math.round(monthlyAvgRent),
    cap_rate_pct: capRatePct,
    cash_on_cash_pct: cocPct,
    property_value: value,
    mortgage_balance: mortgage,
    equity,
    narrative,
    flags,
    model: result.model,
    cost_usd: result.costUsd,
    log_id: result.logId,
  };

  // Persist the structured report as its own ai_logs row (separate from the
  // raw LLM trace) so the dashboard can read it cheaply.
  try {
    const admin = createAdminClient();
    await admin.from("ai_logs").insert({
      agent_name: "argus",
      task_description: "financial_audit_report",
      model_used: result.model,
      token_cost: result.costUsd,
      status: "succeeded",
      output_data: report as unknown as Record<string, unknown>,
    });
  } catch {
    /* best-effort */
  }

  revalidatePath("/dashboard");
  return { success: true, report };
}

export async function getLatestAuditReport(): Promise<FinancialAuditReport | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_logs")
    .select("output_data, created_at")
    .eq("agent_name", "argus")
    .eq("task_description", "financial_audit_report")
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.output_data) return null;
  return data.output_data as unknown as FinancialAuditReport;
}
