"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper
// ─────────────────────────────────────────────────────────────────────────────

async function requireOwnerOrManager() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: profile } = await supabase
    .from("users")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || (profile.role !== "owner" && profile.role !== "manager")) {
    return { ok: false as const, error: "Insufficient permissions" };
  }
  return { ok: true as const, user, profile };
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit profile
// ─────────────────────────────────────────────────────────────────────────────

export type UpdateUnitInput = {
  unitId: string;
  marketRent?: number | null;        // units.monthly_rent — "Market Rent Baseline"
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  status?: "occupied" | "vacant" | "maintenance";
  notes?: string | null;
};

export type ProfileUpdateResult = {
  success: boolean;
  error?: string;
  log_id?: string;
};

export async function updateUnitProfile(input: UpdateUnitInput): Promise<ProfileUpdateResult> {
  const auth = await requireOwnerOrManager();
  if (!auth.ok) return { success: false, error: auth.error };
  if (!input.unitId) return { success: false, error: "unitId required" };

  const admin = createAdminClient();

  const { data: before, error: readErr } = await admin
    .from("units")
    .select("id, unit_number, monthly_rent, bedrooms, bathrooms, sqft, status, notes")
    .eq("id", input.unitId)
    .maybeSingle();
  if (readErr || !before) return { success: false, error: "Unit not found" };

  const patch: Record<string, unknown> = {};
  if (input.marketRent !== undefined)
    patch.monthly_rent = input.marketRent != null ? Number(input.marketRent) : null;
  if (input.bedrooms !== undefined) patch.bedrooms = input.bedrooms;
  if (input.bathrooms !== undefined) patch.bathrooms = input.bathrooms;
  if (input.sqft !== undefined) patch.sqft = input.sqft;
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;

  if (Object.keys(patch).length === 0) {
    return { success: true };
  }

  const { error: updErr } = await admin.from("units").update(patch).eq("id", input.unitId);
  if (updErr) return { success: false, error: `Update failed: ${updErr.message}` };

  let logId: string | undefined;
  try {
    const { data: log } = await admin
      .from("ai_logs")
      .insert({
        agent_name: "profile-unit",
        task_description: "update_unit_profile",
        model_used: "deterministic",
        token_cost: 0,
        status: "succeeded",
        output_data: {
          unit_id: input.unitId,
          unit_number: before.unit_number,
          updated_by: auth.profile.name,
          updated_at: new Date().toISOString(),
          before: {
            monthly_rent: before.monthly_rent,
            bedrooms: before.bedrooms,
            bathrooms: before.bathrooms,
            sqft: before.sqft,
            status: before.status,
            notes: before.notes,
          },
          patch,
        } as Record<string, unknown>,
      })
      .select("id")
      .single();
    logId = log?.id;
  } catch {
    /* best-effort */
  }

  revalidatePath("/units");
  revalidatePath("/dashboard");
  revalidatePath("/finance");

  return { success: true, log_id: logId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant profile (+ optional unit reassignment with status reconciliation)
// ─────────────────────────────────────────────────────────────────────────────

export type UpdateTenantInput = {
  tenantId: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  /** Updates the most-recent active lease's monthly_rent. */
  monthlyRent?: number | null;
  /** Reassign the tenant's active lease to a new unit. Reconciles old/new units.status. */
  reassignToUnitId?: string;
};

export async function updateTenantProfile(
  input: UpdateTenantInput
): Promise<ProfileUpdateResult> {
  const auth = await requireOwnerOrManager();
  if (!auth.ok) return { success: false, error: auth.error };
  if (!input.tenantId) return { success: false, error: "tenantId required" };

  const admin = createAdminClient();

  // ── Load before state ──────────────────────────────────────────────────
  const { data: beforeTenant, error: tenantErr } = await admin
    .from("tenants")
    .select("id, first_name, last_name, email, phone, property_id, status")
    .eq("id", input.tenantId)
    .maybeSingle();
  if (tenantErr || !beforeTenant) return { success: false, error: "Tenant not found" };

  const { data: activeLease } = await admin
    .from("leases")
    .select("id, unit_id, monthly_rent, status, start_date")
    .eq("tenant_id", input.tenantId)
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── Tenant row patch ───────────────────────────────────────────────────
  const tenantPatch: Record<string, unknown> = {};
  if (input.firstName !== undefined) tenantPatch.first_name = input.firstName.trim();
  if (input.lastName !== undefined) tenantPatch.last_name = input.lastName.trim();
  if (input.email !== undefined) tenantPatch.email = input.email?.trim() || null;
  if (input.phone !== undefined) tenantPatch.phone = input.phone?.trim() || null;

  if (Object.keys(tenantPatch).length > 0) {
    const { error } = await admin.from("tenants").update(tenantPatch).eq("id", input.tenantId);
    if (error) return { success: false, error: `Tenant update failed: ${error.message}` };
  }

  // ── Lease patches (rent + unit reassignment) ──────────────────────────
  const leasePatch: Record<string, unknown> = {};
  if (input.monthlyRent !== undefined && input.monthlyRent != null) {
    if (!Number.isFinite(input.monthlyRent) || input.monthlyRent < 0) {
      return { success: false, error: "monthlyRent must be a non-negative number" };
    }
    leasePatch.monthly_rent = Number(input.monthlyRent);
  }

  const isReassign =
    input.reassignToUnitId && activeLease && input.reassignToUnitId !== activeLease.unit_id;

  if (isReassign && activeLease) {
    leasePatch.unit_id = input.reassignToUnitId;
  }

  if (Object.keys(leasePatch).length > 0) {
    if (!activeLease) {
      return {
        success: false,
        error: "Cannot update rent or reassign — no active lease for this tenant",
      };
    }
    const { error } = await admin.from("leases").update(leasePatch).eq("id", activeLease.id);
    if (error) return { success: false, error: `Lease update failed: ${error.message}` };
  }

  // ── Reconcile unit occupancy on reassignment ──────────────────────────
  // Old unit → vacant if no other active leases remain.
  // New unit → occupied.
  let oldUnitFlipped: string | null = null;
  let newUnitFlipped: string | null = null;
  if (isReassign && activeLease) {
    const { data: remaining } = await admin
      .from("leases")
      .select("id")
      .eq("unit_id", activeLease.unit_id)
      .eq("status", "active");
    if (!remaining || remaining.length === 0) {
      await admin.from("units").update({ status: "vacant" }).eq("id", activeLease.unit_id);
      oldUnitFlipped = activeLease.unit_id;
    }
    await admin
      .from("units")
      .update({ status: "occupied" })
      .eq("id", input.reassignToUnitId!);
    newUnitFlipped = input.reassignToUnitId!;
  }

  // ── Audit log ──────────────────────────────────────────────────────────
  let logId: string | undefined;
  try {
    const { data: log } = await admin
      .from("ai_logs")
      .insert({
        agent_name: "profile-tenant",
        task_description: "update_tenant_profile",
        model_used: "deterministic",
        token_cost: 0,
        status: "succeeded",
        output_data: {
          tenant_id: input.tenantId,
          updated_by: auth.profile.name,
          updated_at: new Date().toISOString(),
          before: {
            first_name: beforeTenant.first_name,
            last_name: beforeTenant.last_name,
            email: beforeTenant.email,
            phone: beforeTenant.phone,
          },
          tenant_patch: tenantPatch,
          lease_patch: Object.keys(leasePatch).length > 0 ? leasePatch : null,
          lease_id: activeLease?.id ?? null,
          reassignment: isReassign
            ? {
                from_unit_id: activeLease!.unit_id,
                to_unit_id: input.reassignToUnitId,
                old_unit_flipped_vacant: oldUnitFlipped,
                new_unit_flipped_occupied: newUnitFlipped,
              }
            : null,
        } as Record<string, unknown>,
      })
      .select("id")
      .single();
    logId = log?.id;
  } catch {
    /* best-effort */
  }

  revalidatePath("/tenants");
  revalidatePath("/units");
  revalidatePath("/dashboard");

  return { success: true, log_id: logId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Create tenant (+ optional lease + onboarding token)
// ─────────────────────────────────────────────────────────────────────────────

export type CreateTenantInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  notes?: string | null;
  /** Status: 'prospect' if no lease yet, 'active' if assigning a unit immediately. */
  initialStatus?: "active" | "prospect";

  // Optional lease — set unitId to assign immediately
  unitId?: string | null;
  monthlyRent?: number | null;
  securityDeposit?: number | null;
  startDate?: string | null;       // YYYY-MM-DD
  endDate?: string | null;
  leaseType?: "fixed" | "month-to-month";
  /** Mint a one-time onboarding URL and return it (does not send any email). */
  generateOnboardingToken?: boolean;
};

export type CreateTenantResult = {
  success: boolean;
  error?: string;
  tenant_id?: string;
  lease_id?: string;
  onboarding_url?: string;
  unit_flipped_occupied?: boolean;
};

export async function createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
  const auth = await requireOwnerOrManager();
  if (!auth.ok) return { success: false, error: auth.error };

  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  if (!firstName || !lastName) {
    return { success: false, error: "First and last name are required" };
  }
  if (!input.email?.trim() && !input.phone?.trim()) {
    return { success: false, error: "Email or phone required (need a contact channel)" };
  }

  const admin = createAdminClient();

  // Single-property setup: locate the property row.
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!property) return { success: false, error: "No property row to attach tenant to" };

  // ── 1. Insert tenant ───────────────────────────────────────────────────
  const status =
    input.initialStatus ?? (input.unitId ? "active" : "prospect");

  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .insert({
      property_id: property.id,
      first_name: firstName,
      last_name: lastName,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      emergency_contact_name: input.emergencyContactName?.trim() || null,
      emergency_contact_phone: input.emergencyContactPhone?.trim() || null,
      status,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (tErr || !tenant) {
    return { success: false, error: `Tenant insert failed: ${tErr?.message ?? "no row"}` };
  }

  let leaseId: string | undefined;
  let unitFlipped = false;
  let onboardingUrl: string | undefined;

  // ── 2. Optional lease ──────────────────────────────────────────────────
  if (input.unitId) {
    const monthlyRent = input.monthlyRent;
    if (monthlyRent == null || !Number.isFinite(monthlyRent) || monthlyRent < 0) {
      return {
        success: false,
        error: "monthlyRent is required when assigning a unit",
        tenant_id: tenant.id,
      };
    }
    const startDate = input.startDate || new Date().toISOString().split("T")[0];
    const onboardingToken = input.generateOnboardingToken
      ? randomBytes(24).toString("base64url")
      : null;

    const { data: lease, error: lErr } = await admin
      .from("leases")
      .insert({
        unit_id: input.unitId,
        tenant_id: tenant.id,
        start_date: startDate,
        end_date: input.endDate || null,
        monthly_rent: monthlyRent,
        security_deposit: input.securityDeposit ?? null,
        lease_type: input.leaseType ?? "fixed",
        status: "active",
        onboarding_token: onboardingToken,
        onboarding_sent_at: onboardingToken ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (lErr) {
      return {
        success: false,
        error: `Lease insert failed: ${lErr.message}`,
        tenant_id: tenant.id,
      };
    }
    leaseId = lease.id;

    // ── 3. Flip unit → occupied
    const { error: unitErr } = await admin
      .from("units")
      .update({ status: "occupied" })
      .eq("id", input.unitId);
    if (!unitErr) unitFlipped = true;

    if (onboardingToken) {
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      onboardingUrl = `${origin}/onboard/${onboardingToken}`;
    }
  }

  // ── 4. Audit log ───────────────────────────────────────────────────────
  try {
    await admin.from("ai_logs").insert({
      agent_name: "profile-tenant",
      task_description: "create_tenant",
      model_used: "deterministic",
      token_cost: 0,
      status: "succeeded",
      output_data: {
        tenant_id: tenant.id,
        tenant_name: `${firstName} ${lastName}`,
        created_by: auth.profile.name,
        created_at: new Date().toISOString(),
        initial_status: status,
        lease_id: leaseId ?? null,
        unit_id: input.unitId ?? null,
        unit_flipped_occupied: unitFlipped,
        onboarding_token_minted: !!onboardingUrl,
      } as Record<string, unknown>,
    });
  } catch {
    /* best-effort */
  }

  revalidatePath("/tenants");
  revalidatePath("/units");
  revalidatePath("/dashboard");

  return {
    success: true,
    tenant_id: tenant.id,
    lease_id: leaseId,
    onboarding_url: onboardingUrl,
    unit_flipped_occupied: unitFlipped,
  };
}
