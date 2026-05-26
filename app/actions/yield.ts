"use server";

import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";
import {
  analyzeUnits,
  type LossToLeaseAnalysis,
  type UnitYieldInput,
} from "@/lib/ai/agents/argus-yield";

/**
 * Pulls every unit on the property, joins each unit's most-recent
 * active lease (rent + end date + tenant), runs Argus-Yield, and
 * persists the analysis to ai_logs.
 */
export async function analyzeLossToLease(opts: {
  includeNarrative?: boolean;
} = {}): Promise<{
  success: boolean;
  analysis: LossToLeaseAnalysis | null;
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("id, zip")
    .limit(1)
    .maybeSingle();
  if (propErr || !property) {
    return { success: false, analysis: null, error: propErr?.message ?? "No property found" };
  }

  const { data: units, error: unitsErr } = await supabase
    .from("units")
    .select("id, unit_number, bedrooms, bathrooms, sqft, status")
    .eq("property_id", property.id)
    .order("unit_number");
  if (unitsErr) return { success: false, analysis: null, error: unitsErr.message };

  const unitRows = units ?? [];

  // Pull all active leases for these units in one query
  const { data: leases } = await supabase
    .from("leases")
    .select("id, unit_id, monthly_rent, end_date, tenant_id, status, start_date")
    .in("unit_id", unitRows.map((u) => u.id))
    .eq("status", "active");

  // Pull tenant names for those leases
  const tenantIds = (leases ?? []).map((l) => l.tenant_id).filter(Boolean);
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, first_name, last_name")
    .in("id", tenantIds.length > 0 ? tenantIds : ["00000000-0000-0000-0000-000000000000"]);
  const tenantById = new Map(
    (tenants ?? []).map((t) => [t.id, `${t.first_name} ${t.last_name}`.trim()])
  );

  // Index most-recent active lease per unit
  type LeaseRow = NonNullable<typeof leases>[number];
  const leaseByUnit = new Map<string, LeaseRow>();
  for (const lease of leases ?? []) {
    const existing = leaseByUnit.get(lease.unit_id);
    if (
      !existing ||
      new Date(lease.start_date).getTime() > new Date(existing.start_date).getTime()
    ) {
      leaseByUnit.set(lease.unit_id, lease);
    }
  }

  const input: UnitYieldInput[] = unitRows.map((u) => {
    const lease = leaseByUnit.get(u.id);
    return {
      unit_id: u.id,
      unit_number: u.unit_number,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms != null ? Number(u.bathrooms) : null,
      sqft: u.sqft,
      status: u.status,
      active_lease_id: lease?.id ?? null,
      active_lease_rent: lease?.monthly_rent != null ? Number(lease.monthly_rent) : null,
      active_lease_end: lease?.end_date ?? null,
      tenant_name: lease?.tenant_id ? tenantById.get(lease.tenant_id) ?? null : null,
    };
  });

  const analysis = await analyzeUnits(input, {
    zip: property.zip ?? "78040",
    includeNarrative: opts.includeNarrative ?? true,
  });

  try {
    await admin.from("ai_logs").insert({
      agent_name: "argus-yield",
      task_description: "loss_to_lease_analysis",
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

export async function getLatestYieldAnalysis(): Promise<LossToLeaseAnalysis | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_logs")
    .select("output_data")
    .eq("agent_name", "argus-yield")
    .eq("task_description", "loss_to_lease_analysis")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.output_data as unknown as LossToLeaseAnalysis) ?? null;
}
