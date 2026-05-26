"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";
import {
  fetchWebbCountyAppraisal,
  type CadLookupInput,
  type CadParseResult,
} from "@/lib/ai/agents/argus-cad";

export type TaxSyncResult = {
  success: boolean;
  error?: string;
  status?: CadParseResult["status"];
  data?: CadParseResult;
  delta?: {
    market_value: number | null;
    taxable_value: number | null;
    tax_levy: number | null;
  };
  log_id?: string;
};

/**
 * Pulls the latest assessment from Webb CAD for the property's address
 * (or stored CAD account), updates the properties row, appends a row to
 * property_tax_history with the delta vs the prior value, and writes a
 * narrative entry to ai_logs.
 */
export async function syncWebbCountyTaxData(
  propertyId?: string
): Promise<TaxSyncResult> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  // ── 1. Load the target property ────────────────────────────────────────
  const propertyQuery = propertyId
    ? supabase
        .from("properties")
        .select(
          "id, name, address, zip, current_value, cad_account_number, assessed_market_value, assessed_taxable_value, tax_levy_current_year"
        )
        .eq("id", propertyId)
        .maybeSingle()
    : supabase
        .from("properties")
        .select(
          "id, name, address, zip, current_value, cad_account_number, assessed_market_value, assessed_taxable_value, tax_levy_current_year"
        )
        .limit(1)
        .maybeSingle();

  const { data: property, error: propErr } = await propertyQuery;
  if (propErr || !property) {
    return { success: false, error: propErr?.message ?? "No property found" };
  }

  // ── 2. Build lookup input ──────────────────────────────────────────────
  const lookup: CadLookupInput = property.cad_account_number
    ? { kind: "account", account: property.cad_account_number }
    : { kind: "address", street: property.address, zip: property.zip || "78040" };

  // ── 3. Hit Argus-CAD ───────────────────────────────────────────────────
  const cad = await fetchWebbCountyAppraisal(lookup);

  // ── 4. Compute deltas vs prior stored values ───────────────────────────
  const priorMarket = numberOrNull(property.assessed_market_value);
  const priorTaxable = numberOrNull(property.assessed_taxable_value);
  const priorLevy = numberOrNull(property.tax_levy_current_year);
  const delta = {
    market_value: diff(cad.assessed_market_value, priorMarket),
    taxable_value: diff(cad.assessed_taxable_value, priorTaxable),
    tax_levy: diff(cad.tax_levy_current_year, priorLevy),
  };

  // ── 5. Persist (only if parse succeeded with at least one field) ───────
  if (cad.status === "ok") {
    const updatePayload: Record<string, unknown> = {
      cad_last_synced_at: cad.fetched_at,
      cad_source_url: cad.source_url,
    };
    if (cad.assessed_market_value != null)
      updatePayload.assessed_market_value = cad.assessed_market_value;
    if (cad.assessed_taxable_value != null)
      updatePayload.assessed_taxable_value = cad.assessed_taxable_value;
    if (cad.tax_levy_current_year != null)
      updatePayload.tax_levy_current_year = cad.tax_levy_current_year;
    if (cad.protest_deadline) updatePayload.protest_deadline = cad.protest_deadline;
    if (cad.cad_account_number && !property.cad_account_number)
      updatePayload.cad_account_number = cad.cad_account_number;

    const { error: updErr } = await admin
      .from("properties")
      .update(updatePayload)
      .eq("id", property.id);
    if (updErr) {
      return {
        success: false,
        error: `Property update failed: ${updErr.message}`,
        status: cad.status,
        data: cad,
      };
    }

    // Append to history (best-effort)
    await admin.from("property_tax_history").insert({
      property_id: property.id,
      synced_at: cad.fetched_at,
      tax_year: cad.tax_year,
      assessed_market_value: cad.assessed_market_value,
      assessed_taxable_value: cad.assessed_taxable_value,
      tax_levy: cad.tax_levy_current_year,
      protest_deadline: cad.protest_deadline,
      cad_account_number: cad.cad_account_number ?? property.cad_account_number,
      source_url: cad.source_url,
      raw_html_excerpt: cad.raw_excerpt,
      parsed_by_model: cad.parsed_by_model,
      parse_cost_usd: cad.parse_cost_usd,
      delta_market_value: delta.market_value,
      delta_taxable_value: delta.taxable_value,
      delta_tax_levy: delta.tax_levy,
      notes: cad.notes.length ? cad.notes.join(" · ") : null,
    });
  }

  // ── 6. Audit narrative to ai_logs ──────────────────────────────────────
  const narrative = buildNarrative(property.name, cad, delta);
  const { data: logRow } = await admin
    .from("ai_logs")
    .insert({
      agent_name: "argus-cad",
      task_description: "webb_county_tax_sync",
      model_used: cad.parsed_by_model ?? "regex-only",
      token_cost: cad.parse_cost_usd,
      status: cad.status === "ok" ? "succeeded" : "failed",
      output_data: {
        narrative,
        property_id: property.id,
        cad,
        delta,
      },
    })
    .select("id")
    .single();

  revalidatePath("/dashboard");
  revalidatePath("/equity");

  return {
    success: cad.status === "ok",
    status: cad.status,
    data: cad,
    delta,
    log_id: logRow?.id,
    error:
      cad.status === "ok"
        ? undefined
        : cad.notes.join(" · ") || `CAD lookup returned status=${cad.status}`,
  };
}

/**
 * Returns the most recent CAD sync result for the property's dashboard
 * sub-card. Cheap — single ai_logs query.
 */
export async function getLatestCadSync(
  propertyId?: string
): Promise<{
  cad: CadParseResult | null;
  delta: { market_value: number | null; taxable_value: number | null; tax_levy: number | null } | null;
  internal_value: number | null;
  synced_at: string | null;
  protest_deadline: string | null;
}> {
  const supabase = createAdminClient();

  const propertyQuery = propertyId
    ? supabase.from("properties").select("id, current_value, protest_deadline").eq("id", propertyId).maybeSingle()
    : supabase.from("properties").select("id, current_value, protest_deadline").limit(1).maybeSingle();
  const { data: property } = await propertyQuery;
  if (!property) {
    return { cad: null, delta: null, internal_value: null, synced_at: null, protest_deadline: null };
  }

  const { data } = await supabase
    .from("ai_logs")
    .select("output_data, created_at")
    .eq("agent_name", "argus-cad")
    .eq("task_description", "webb_county_tax_sync")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const out = data?.output_data as
    | { cad: CadParseResult; delta: TaxSyncResult["delta"] }
    | undefined;

  return {
    cad: out?.cad ?? null,
    delta: out?.delta ?? null,
    internal_value: numberOrNull(property.current_value),
    synced_at: data?.created_at ?? null,
    protest_deadline: property.protest_deadline as string | null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

function numberOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function diff(curr: number | null, prior: number | null): number | null {
  if (curr == null || prior == null) return null;
  return Number((curr - prior).toFixed(2));
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function buildNarrative(
  propertyName: string,
  cad: CadParseResult,
  delta: { market_value: number | null; taxable_value: number | null; tax_levy: number | null }
): string {
  if (cad.status !== "ok") {
    return `Argus-CAD sync for ${propertyName} ended status=${cad.status}. ${cad.notes.join(" · ")}`;
  }

  const parts: string[] = [];
  parts.push(
    `Webb CAD reports ${propertyName} at ${fmtUsd(cad.assessed_market_value)} market / ${fmtUsd(cad.assessed_taxable_value)} taxable for tax year ${cad.tax_year ?? "—"}.`
  );
  parts.push(`Current year levy: ${fmtUsd(cad.tax_levy_current_year)}.`);
  if (cad.protest_deadline) parts.push(`Protest deadline: ${cad.protest_deadline}.`);

  if (delta.market_value != null && delta.market_value !== 0) {
    const dir = delta.market_value > 0 ? "up" : "down";
    parts.push(`Market value moved ${dir} ${fmtUsd(Math.abs(delta.market_value))} vs prior sync.`);
  }
  if (delta.tax_levy != null && delta.tax_levy !== 0) {
    const dir = delta.tax_levy > 0 ? "rose" : "fell";
    parts.push(`Levy ${dir} ${fmtUsd(Math.abs(delta.tax_levy))}.`);
  }
  return parts.join(" ");
}
