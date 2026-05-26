"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";
import { suggestDispatch, type DispatchSuggestion, type VendorRow } from "@/lib/ai/agents/argus-dispatch";

export type GetSuggestionResult = {
  success: boolean;
  error?: string;
  suggestion?: DispatchSuggestion;
};

/**
 * Pure suggestion — no DB mutation. Reads the work order + all vendors,
 * runs Argus-Dispatch, returns the classification + matched vendor +
 * cost range. Safe to call repeatedly; does not log to ai_logs (the
 * approve flow is what creates the audit trail).
 */
export async function getDispatchSuggestion(
  workOrderId: string
): Promise<GetSuggestionResult> {
  const supabase = await createServerSupabaseClient();

  const { data: wo, error: woErr } = await supabase
    .from("work_orders")
    .select("id, title, description, priority, unit_id, status, vendor_id, property_id")
    .eq("id", workOrderId)
    .maybeSingle();
  if (woErr || !wo) return { success: false, error: woErr?.message ?? "Work order not found" };
  if (wo.status === "resolved" || wo.status === "completed" || wo.status === "cancelled") {
    return { success: false, error: `Work order is ${wo.status} — no dispatch needed` };
  }

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, name, trade, billing_rate, email, phone")
    .eq("property_id", wo.property_id);

  const suggestion = await suggestDispatch(
    {
      id: wo.id,
      title: wo.title,
      description: wo.description,
      priority: wo.priority,
      unit_id: wo.unit_id,
    },
    (vendors ?? []) as VendorRow[]
  );

  return { success: true, suggestion };
}

export type ApproveDispatchInput = {
  workOrderId: string;
  /** When provided, overrides the agent's suggestion. */
  vendorId?: string;
  estimatedCost?: number;
};

export type ApproveDispatchResult = {
  success: boolean;
  error?: string;
  work_order_id?: string;
  vendor_id?: string | null;
  estimated_cost?: number | null;
  log_id?: string;
};

/**
 * 1-click dispatch:
 *   - auth-gates to owner/manager
 *   - re-runs the suggestion so the caller can't tamper with what gets
 *     written (or accepts an explicit vendorId/estimatedCost override)
 *   - flips work_orders.status to 'in_progress', sets vendor_id +
 *     estimated_cost + scheduled_at = now
 *   - writes a full audit row to ai_logs with the projected obligation
 *     (vendor, cost range, unit_id, AI cost if any)
 *
 * Notes on the "pending transaction": we deliberately DO NOT insert
 * a transactions row at dispatch time — the existing resolveWorkOrder
 * flow posts the actual cost when the WO is marked resolved, so adding
 * a pending row here would double-count. The work_orders row itself
 * (with estimated_cost) IS the pending obligation, and the ai_logs
 * entry is the audit. The Per-Unit P&L grid surfaces both.
 */
export async function approveAndDispatch(
  input: ApproveDispatchInput
): Promise<ApproveDispatchResult> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  // ── Auth gate ─────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("users")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || (profile.role !== "owner" && profile.role !== "manager")) {
    return { success: false, error: "Only owner/manager can dispatch vendors" };
  }

  // ── Re-derive the suggestion for the audit trail ──────────────────────
  const suggestionResult = await getDispatchSuggestion(input.workOrderId);
  if (!suggestionResult.success || !suggestionResult.suggestion) {
    return { success: false, error: suggestionResult.error ?? "Could not compute suggestion" };
  }
  const suggestion = suggestionResult.suggestion;

  // Resolve vendor: caller override wins, else use suggestion.matched_vendor.id
  const vendorId = input.vendorId ?? suggestion.matched_vendor?.id ?? null;
  if (!vendorId) {
    return {
      success: false,
      error: `No ${suggestion.detected_trade} vendor available. Add one or pass vendorId explicitly.`,
    };
  }

  const estimatedCost =
    input.estimatedCost != null && Number.isFinite(input.estimatedCost) && input.estimatedCost > 0
      ? input.estimatedCost
      : suggestion.cost_estimate_low_usd > 0
        ? Math.round((suggestion.cost_estimate_low_usd + suggestion.cost_estimate_high_usd) / 2)
        : suggestion.cost_baseline_usd;

  // ── Write to work_orders ──────────────────────────────────────────────
  const scheduledAt = new Date().toISOString();
  const { data: updated, error: updErr } = await admin
    .from("work_orders")
    .update({
      vendor_id: vendorId,
      status: "in_progress",
      estimated_cost: estimatedCost,
      scheduled_at: scheduledAt,
    })
    .eq("id", input.workOrderId)
    .select("id, unit_id")
    .single();
  if (updErr) {
    return { success: false, error: `Dispatch update failed: ${updErr.message}` };
  }

  // ── Resolve vendor name for the log payload ───────────────────────────
  const { data: vendorRow } = await admin
    .from("vendors")
    .select("name, trade, billing_rate")
    .eq("id", vendorId)
    .maybeSingle();

  // ── Audit ─────────────────────────────────────────────────────────────
  let logId: string | undefined;
  try {
    const { data: log } = await admin
      .from("ai_logs")
      .insert({
        agent_name: "argus-dispatch",
        task_description: "approve_and_dispatch",
        model_used: suggestion.ai_model ?? "deterministic",
        token_cost: suggestion.ai_cost_usd,
        status: "succeeded",
        output_data: {
          work_order_id: input.workOrderId,
          unit_id: updated?.unit_id ?? null,
          dispatched_by: profile.name,
          dispatched_at: scheduledAt,
          vendor_id: vendorId,
          vendor_name: vendorRow?.name ?? null,
          vendor_trade: vendorRow?.trade ?? null,
          vendor_billing_rate: vendorRow?.billing_rate ?? null,
          detected_trade: suggestion.detected_trade,
          trade_confidence: suggestion.trade_confidence,
          match_explanation: suggestion.match_explanation,
          estimated_cost: estimatedCost,
          cost_estimate_low_usd: suggestion.cost_estimate_low_usd,
          cost_estimate_high_usd: suggestion.cost_estimate_high_usd,
          urgency_multiplier: suggestion.urgency_multiplier,
          ai_used: suggestion.ai_used,
          rationale: suggestion.rationale,
          // Explicit reminder that this is a pending obligation, not a
          // posted expense. The expense is recorded on resolve.
          pending_transaction_note: `Pending maintenance — ~$${estimatedCost} reserved against unit ${updated?.unit_id ?? "common-area"}. Reconciled to transactions on resolveWorkOrder().`,
        } as Record<string, unknown>,
      })
      .select("id")
      .single();
    logId = log?.id;
  } catch {
    /* best-effort */
  }

  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  revalidatePath("/finance");

  return {
    success: true,
    work_order_id: input.workOrderId,
    vendor_id: vendorId,
    estimated_cost: estimatedCost,
    log_id: logId,
  };
}
