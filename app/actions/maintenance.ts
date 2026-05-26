"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";

export type MaintenanceLogInput = {
  unitId: string | null;
  description: string;
  amount: number | null;       // null = log a ticket only (no expense yet)
  vendorId?: string | null;
  date?: string;               // YYYY-MM-DD; defaults to today
  category?: string;           // expense category, default "maintenance"
  status?: "open" | "in_progress" | "resolved";
};

export type MaintenanceLogResult = {
  success: boolean;
  error?: string;
  work_order_id?: string;
  transaction_id?: string;
};

/**
 * Single round-trip "maintenance happened" logger:
 *   - Always creates a work_orders row (status defaults to "resolved"
 *     when an amount is present, "open" otherwise).
 *   - When amount > 0, also inserts a matching transaction
 *     (category="maintenance"), attributed to the unit if specified.
 *   - Auditable: returns both IDs so the UI can link straight to them.
 */
export async function logMaintenance(
  input: MaintenanceLogInput
): Promise<MaintenanceLogResult> {
  const description = input.description?.trim();
  if (!description) return { success: false, error: "Description is required" };

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (propErr || !property) {
    return { success: false, error: propErr?.message ?? "No property found" };
  }

  const amount =
    input.amount != null && Number.isFinite(input.amount) && input.amount > 0
      ? Number(input.amount)
      : null;

  const date = input.date ?? new Date().toISOString().split("T")[0];
  const status = input.status ?? (amount != null ? "resolved" : "open");

  // ── 1. work_order ───────────────────────────────────────────────────────
  const title =
    description.length > 60 ? description.slice(0, 57).trim() + "…" : description;

  const { data: wo, error: woErr } = await admin
    .from("work_orders")
    .insert({
      property_id: property.id,
      unit_id: input.unitId ?? null,
      vendor_id: input.vendorId ?? null,
      title,
      description,
      category: input.category ?? "maintenance",
      priority: "medium",
      status,
      estimated_cost: amount,
      actual_cost: status === "resolved" ? amount : null,
      completed_at: status === "resolved" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (woErr) return { success: false, error: `work_order insert failed: ${woErr.message}` };

  // ── 2. transaction (only when an amount was provided) ───────────────────
  let txId: string | undefined;
  if (amount != null) {
    let vendorName: string | null = null;
    if (input.vendorId) {
      const { data: v } = await admin
        .from("vendors")
        .select("name")
        .eq("id", input.vendorId)
        .maybeSingle();
      vendorName = v?.name ?? null;
    }

    const { data: tx, error: txErr } = await admin
      .from("transactions")
      .insert({
        property_id: property.id,
        unit_id: input.unitId ?? null,
        amount,
        date,
        type: "expense",
        category: input.category ?? "maintenance",
        description: vendorName ? `${description} — ${vendorName}` : description,
        notes: `Auto-logged from maintenance form (work_order ${wo.id})`,
      })
      .select("id")
      .single();
    if (txErr) {
      // Roll back the orphan work order? Don't — the WO is still useful as a
      // ticket. Surface the warning so the UI can show "logged but expense
      // not posted."
      return {
        success: true,
        work_order_id: wo.id,
        error: `Expense not posted: ${txErr.message}`,
      };
    }
    txId = tx.id;
  }

  revalidatePath("/dashboard");
  revalidatePath("/finance");
  revalidatePath("/work-orders");

  return { success: true, work_order_id: wo.id, transaction_id: txId };
}
