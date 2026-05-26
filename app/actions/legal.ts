"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";
import { generateTexasNoticeToVacate } from "@/lib/lease-pdf";

const BUCKET = "contracts";
const STATUTORY_MIN_DAYS = 3;

export type DelinquencyStatus = {
  tenant_id: string;
  lease_id: string | null;
  unit_id: string | null;
  unit_number: string | null;
  scheduled_rent: number | null;
  paid_this_month: number;
  past_due_amount: number;
  is_delinquent: boolean;
  rent_due_date: string;
};

/**
 * Compute current-month rent delinquency for every active-lease tenant.
 * "Delinquent" = scheduled rent > 0 AND amount paid this month < scheduled rent
 * AND today is past the first of the month.
 */
export async function getDelinquencyMap(): Promise<Record<string, DelinquencyStatus>> {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!property) return {};

  const today = new Date();
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}-01`;
  const todayIso = today.toISOString().split("T")[0];

  const [leasesRes, txRes, unitsRes] = await Promise.all([
    supabase
      .from("leases")
      .select("id, tenant_id, unit_id, monthly_rent, status, start_date")
      .eq("status", "active"),
    supabase
      .from("transactions")
      .select("unit_id, amount, type, category, date")
      .eq("property_id", property.id)
      .eq("type", "income")
      .eq("category", "rent")
      .gte("date", firstOfMonth)
      .lte("date", todayIso),
    supabase
      .from("units")
      .select("id, unit_number")
      .eq("property_id", property.id),
  ]);

  const unitNumberById = new Map(
    (unitsRes.data ?? []).map((u) => [u.id, u.unit_number])
  );

  const paidByUnit = new Map<string, number>();
  for (const t of txRes.data ?? []) {
    if (!t.unit_id) continue;
    paidByUnit.set(t.unit_id, (paidByUnit.get(t.unit_id) ?? 0) + Number(t.amount));
  }

  const map: Record<string, DelinquencyStatus> = {};
  const leasesByTenant = new Map<
    string,
    NonNullable<typeof leasesRes.data>[number]
  >();
  for (const l of leasesRes.data ?? []) {
    const prior = leasesByTenant.get(l.tenant_id);
    if (
      !prior ||
      new Date(l.start_date).getTime() > new Date(prior.start_date).getTime()
    ) {
      leasesByTenant.set(l.tenant_id, l);
    }
  }

  for (const [tenantId, lease] of leasesByTenant) {
    const scheduledRent = Number(lease.monthly_rent ?? 0);
    const paid = paidByUnit.get(lease.unit_id) ?? 0;
    const pastDue = Math.max(0, scheduledRent - paid);
    map[tenantId] = {
      tenant_id: tenantId,
      lease_id: lease.id,
      unit_id: lease.unit_id,
      unit_number: unitNumberById.get(lease.unit_id) ?? null,
      scheduled_rent: scheduledRent,
      paid_this_month: paid,
      past_due_amount: pastDue,
      is_delinquent: scheduledRent > 0 && pastDue > 0 && todayIso > firstOfMonth,
      rent_due_date: firstOfMonth,
    };
  }

  return map;
}

export type GenerateNoticeInput = {
  leaseId: string;
  deliveryMethod?: "in_person" | "first_class_mail" | "certified_mail" | "posted_on_door";
  noticePeriodDays?: number;
};

export type GenerateNoticeResult = {
  success: boolean;
  error?: string;
  url?: string;
  storage_key?: string;
  past_due_amount?: number;
  vacate_by?: string;
};

/**
 * Generates the § 24.005 3-Day Notice to Vacate, uploads it to the
 * private `contracts` bucket under notices/, and logs the issuance to
 * ai_logs for the legal audit trail. Returns a signed URL.
 */
export async function generateNoticeToVacate(
  input: GenerateNoticeInput
): Promise<GenerateNoticeResult> {
  const noticeDays = input.noticePeriodDays ?? STATUTORY_MIN_DAYS;
  const deliveryMethod = input.deliveryMethod ?? "in_person";

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { success: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("users")
    .select("name, role")
    .eq("id", user.user.id)
    .maybeSingle();
  if (!profile || (profile.role !== "owner" && profile.role !== "manager")) {
    return { success: false, error: "Only owner/manager can issue notices" };
  }

  // ── Hydrate the lease bundle ──────────────────────────────────────────
  const { data: lease, error: leaseErr } = await admin
    .from("leases")
    .select("id, tenant_id, unit_id, monthly_rent, status, start_date")
    .eq("id", input.leaseId)
    .maybeSingle();
  if (leaseErr || !lease) return { success: false, error: "Lease not found" };

  const [tenantRes, unitRes, propertyRes] = await Promise.all([
    admin
      .from("tenants")
      .select("id, first_name, last_name, property_id")
      .eq("id", lease.tenant_id)
      .maybeSingle(),
    admin
      .from("units")
      .select("id, unit_number")
      .eq("id", lease.unit_id)
      .maybeSingle(),
    admin
      .from("properties")
      .select("id, name, address, city, state, zip, owner_entity")
      .limit(1)
      .maybeSingle(),
  ]);
  const tenant = tenantRes.data;
  const unit = unitRes.data;
  const property = propertyRes.data;
  if (!tenant || !unit || !property) {
    return { success: false, error: "Could not resolve tenant / unit / property" };
  }

  // ── Compute past-due ──────────────────────────────────────────────────
  const today = new Date();
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}-01`;
  const todayIso = today.toISOString().split("T")[0];

  const { data: rentPayments } = await admin
    .from("transactions")
    .select("amount")
    .eq("unit_id", lease.unit_id)
    .eq("type", "income")
    .eq("category", "rent")
    .gte("date", firstOfMonth)
    .lte("date", todayIso);

  const scheduledRent = Number(lease.monthly_rent ?? 0);
  const paidThisMonth = (rentPayments ?? []).reduce(
    (s, t) => s + Number(t.amount),
    0
  );
  const pastDue = Math.max(0, scheduledRent - paidThisMonth);

  if (pastDue <= 0) {
    return {
      success: false,
      error: "Tenant is not delinquent — current month's rent is paid in full",
    };
  }

  // ── Render PDF ────────────────────────────────────────────────────────
  const issuedAt = today.toISOString();
  const vacateBy = new Date(today.getTime() + noticeDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const pdfBytes = await generateTexasNoticeToVacate({
    property_full_address: `${property.address}, ${property.city}, ${property.state} ${property.zip}`,
    owner_entity: property.owner_entity || "Landlord",
    owner_signer_name: profile.name || "Authorized agent",
    tenant_name: `${tenant.first_name} ${tenant.last_name}`.trim(),
    unit_number: unit.unit_number,
    past_due_balance: pastDue,
    rent_due_date: firstOfMonth,
    notice_period_days: noticeDays,
    delivery_method: deliveryMethod,
    issued_at: issuedAt,
    vacate_by: vacateBy,
  });

  // ── Upload + sign URL ─────────────────────────────────────────────────
  const key = `${property.id}/notices/${lease.id}/notice-to-vacate-${Date.now()}.pdf`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(key, pdfBytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) return { success: false, error: `Upload failed: ${upErr.message}` };

  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(key, 60 * 60 * 24 * 30); // 30 days

  const url = signed?.signedUrl ?? key;

  // ── Audit log ─────────────────────────────────────────────────────────
  try {
    await admin.from("ai_logs").insert({
      agent_name: "legal-notice",
      task_description: "texas_3_day_notice_to_vacate",
      model_used: "deterministic",
      token_cost: 0,
      status: "succeeded",
      output_data: {
        lease_id: lease.id,
        tenant_id: tenant.id,
        unit_id: lease.unit_id,
        property_id: property.id,
        tenant_name: `${tenant.first_name} ${tenant.last_name}`.trim(),
        unit_number: unit.unit_number,
        past_due_amount: pastDue,
        scheduled_rent: scheduledRent,
        paid_this_month: paidThisMonth,
        notice_period_days: noticeDays,
        delivery_method: deliveryMethod,
        issued_at: issuedAt,
        vacate_by: vacateBy,
        issued_by: profile.name,
        storage_key: key,
        document_url: url,
      } as Record<string, unknown>,
    });
  } catch {
    /* swallow */
  }

  revalidatePath("/tenants");
  revalidatePath("/dashboard");

  return {
    success: true,
    url,
    storage_key: key,
    past_due_amount: pastDue,
    vacate_by: vacateBy,
  };
}
