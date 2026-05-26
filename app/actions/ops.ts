"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";

export type WorkOrderInput = {
  title: string;
  description?: string;
  unitId?: string | null;
  priority?: "low" | "medium" | "high";
  estimatedCost?: number | null;
};

export async function createWorkOrder(
  data: WorkOrderInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!data.title?.trim()) {
    return { success: false, error: "Title is required" };
  }

  const supabase = await createServerSupabaseClient();

  const { data: properties } = await supabase.from("properties").select("id").limit(1);
  const propertyId = properties?.[0]?.id;
  if (!propertyId) return { success: false, error: "No property found" };

  const { data: row, error } = await supabase
    .from("work_orders")
    .insert({
      property_id: propertyId,
      unit_id: data.unitId || null,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      priority: data.priority || "medium",
      estimated_cost: data.estimatedCost ?? null,
      status: "open",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/work-orders");
  return { success: true, id: row.id };
}

export async function assignVendorToOrder(
  orderId: string,
  vendorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("work_orders")
    .update({ vendor_id: vendorId, status: "in_progress" })
    .eq("id", orderId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/work-orders");
  return { success: true };
}

export async function resolveWorkOrder(
  orderId: string,
  actualCost: number
): Promise<{ success: boolean; error?: string }> {
  if (!Number.isFinite(actualCost) || actualCost < 0) {
    return { success: false, error: "Actual cost must be a non-negative number" };
  }

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: order, error: fetchErr } = await supabase
    .from("work_orders")
    .select("id, title, property_id, unit_id, vendor_id")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchErr || !order) {
    return { success: false, error: fetchErr?.message || "Work order not found" };
  }

  const completedAt = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("work_orders")
    .update({
      status: "resolved",
      actual_cost: actualCost,
      completed_at: completedAt,
    })
    .eq("id", orderId);

  if (updateErr) return { success: false, error: updateErr.message };

  if (actualCost > 0) {
    let vendorName: string | null = null;
    if (order.vendor_id) {
      const { data: vendor } = await admin
        .from("vendors")
        .select("name")
        .eq("id", order.vendor_id)
        .maybeSingle();
      vendorName = vendor?.name ?? null;
    }

    const description = vendorName
      ? `${order.title} — ${vendorName}`
      : order.title;

    const { error: txErr } = await admin.from("transactions").insert({
      property_id: order.property_id,
      unit_id: order.unit_id,
      amount: actualCost,
      date: completedAt.split("T")[0],
      type: "expense",
      category: "maintenance",
      description,
      notes: `Auto-logged from work order ${order.id}`,
    });

    if (txErr) {
      console.error("Failed to auto-log maintenance expense:", txErr.message);
    }
  }

  revalidatePath("/work-orders");
  revalidatePath("/finance");
  return { success: true };
}

export async function createVendor(data: {
  name: string;
  trade?: string;
  phone?: string;
  email?: string;
  billingRate?: number | null;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!data.name?.trim()) return { success: false, error: "Name is required" };

  const supabase = await createServerSupabaseClient();

  const { data: properties } = await supabase.from("properties").select("id").limit(1);
  const propertyId = properties?.[0]?.id;

  const { data: row, error } = await supabase
    .from("vendors")
    .insert({
      property_id: propertyId || null,
      name: data.name.trim(),
      trade: data.trade?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      billing_rate: data.billingRate ?? null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/work-orders");
  return { success: true, id: row.id };
}
