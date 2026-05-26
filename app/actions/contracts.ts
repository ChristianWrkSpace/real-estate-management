"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";
import { extractPlaceholders, fillDocxTemplate } from "@/lib/contract-templates";

const BUCKET = "contracts";

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper (mirrors profiles.ts)
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
// Read helpers
// ─────────────────────────────────────────────────────────────────────────────

export type ContractTemplate = {
  id: string;
  kind: string;
  label: string;
  description: string | null;
  storage_key: string;
  file_extension: string;
  placeholders: string[];
  active: boolean;
};

export async function listContractTemplates(opts: {
  includeInactive?: boolean;
} = {}): Promise<ContractTemplate[]> {
  const supabase = await createServerSupabaseClient();
  let q = supabase
    .from("contract_templates")
    .select(
      "id, kind, label, description, storage_key, file_extension, placeholders, active"
    );
  if (!opts.includeInactive) q = q.eq("active", true);
  const { data } = await q.order("label");
  return (data ?? []) as ContractTemplate[];
}

/**
 * Owner-facing detail bundle — template metadata + a signed download
 * URL for the source .docx so the contracts page can offer "Download
 * original" and "Preview" actions.
 */
export type ContractTemplateDetail = ContractTemplate & {
  uploaded_at: string | null;
  download_url: string | null;
};

export async function listContractTemplatesWithUrls(): Promise<ContractTemplateDetail[]> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const { data } = await supabase
    .from("contract_templates")
    .select(
      "id, kind, label, description, storage_key, file_extension, placeholders, active, uploaded_at"
    )
    .order("label");

  const rows = (data ?? []) as (ContractTemplate & { uploaded_at: string | null })[];

  return Promise.all(
    rows.map(async (r) => {
      const { data: signed } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(r.storage_key, 60 * 60 * 24 * 7);
      return { ...r, download_url: signed?.signedUrl ?? null };
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template metadata edit + replace
// ─────────────────────────────────────────────────────────────────────────────

export type UpdateTemplateInput = {
  templateId: string;
  label?: string;
  description?: string | null;
  active?: boolean;
};

export type UpdateTemplateResult = {
  success: boolean;
  error?: string;
};

export async function updateContractTemplate(
  input: UpdateTemplateInput
): Promise<UpdateTemplateResult> {
  const auth = await requireOwnerOrManager();
  if (!auth.ok) return { success: false, error: auth.error };

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label.trim();
  if (input.description !== undefined)
    patch.description = input.description?.trim() || null;
  if (input.active !== undefined) patch.active = input.active;

  if (Object.keys(patch).length === 0) return { success: true };

  const { data: before } = await admin
    .from("contract_templates")
    .select("label, description, active, kind")
    .eq("id", input.templateId)
    .maybeSingle();
  if (!before) return { success: false, error: "Template not found" };

  const { error } = await admin
    .from("contract_templates")
    .update(patch)
    .eq("id", input.templateId);
  if (error) return { success: false, error: `Update failed: ${error.message}` };

  try {
    await admin.from("ai_logs").insert({
      agent_name: "contract-template",
      task_description: "update_template_metadata",
      model_used: "deterministic",
      token_cost: 0,
      status: "succeeded",
      output_data: {
        template_id: input.templateId,
        kind: before.kind,
        updated_by: auth.profile.name,
        updated_at: new Date().toISOString(),
        before,
        patch,
      } as Record<string, unknown>,
    });
  } catch {
    /* best-effort */
  }

  revalidatePath("/contracts");
  revalidatePath("/tenants");
  return { success: true };
}

export type ReplaceTemplateResult = {
  success: boolean;
  error?: string;
  placeholders?: string[];
  new_storage_key?: string;
};

/**
 * Owner uploads a new version of an existing template (or registers a
 * brand-new template under the kind in the FormData). Replaces the
 * docx in storage, re-extracts placeholders, and updates the registry
 * row. The file must be a .docx.
 */
export async function replaceContractTemplate(
  formData: FormData
): Promise<ReplaceTemplateResult> {
  const auth = await requireOwnerOrManager();
  if (!auth.ok) return { success: false, error: auth.error };

  const templateId = formData.get("templateId");
  const file = formData.get("file");
  if (typeof templateId !== "string" || !templateId) {
    return { success: false, error: "templateId required" };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Upload a .docx file" };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { success: false, error: "File exceeds 25MB" };
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return { success: false, error: "Only .docx templates are supported right now" };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("contract_templates")
    .select("id, kind, storage_key")
    .eq("id", templateId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Template not found" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const placeholders = await extractPlaceholders(buffer);

  const key = existing.storage_key || `templates/${existing.kind}.docx`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(key, buffer, {
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: true,
  });
  if (upErr) return { success: false, error: `Upload failed: ${upErr.message}` };

  const { error: regErr } = await admin
    .from("contract_templates")
    .update({
      storage_key: key,
      file_extension: "docx",
      placeholders,
      uploaded_at: new Date().toISOString(),
    })
    .eq("id", templateId);
  if (regErr) return { success: false, error: `Registry update failed: ${regErr.message}` };

  try {
    await admin.from("ai_logs").insert({
      agent_name: "contract-template",
      task_description: "replace_template_source",
      model_used: "deterministic",
      token_cost: 0,
      status: "succeeded",
      output_data: {
        template_id: templateId,
        kind: existing.kind,
        storage_key: key,
        file_size_bytes: buffer.length,
        placeholders,
        uploaded_by: auth.profile.name,
        uploaded_at: new Date().toISOString(),
      } as Record<string, unknown>,
    });
  } catch {
    /* swallow */
  }

  revalidatePath("/contracts");
  revalidatePath("/tenants");

  return {
    success: true,
    placeholders,
    new_storage_key: key,
  };
}

export type TenantDocument = {
  id: string;
  tenant_id: string;
  lease_id: string | null;
  template_kind: string;
  label: string;
  storage_key: string;
  file_extension: string;
  generated_at: string;
  signed_at: string | null;
  signature_name: string | null;
  download_url: string | null;
};

export async function getTenantDocuments(
  tenantId: string
): Promise<TenantDocument[]> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const { data } = await supabase
    .from("tenant_documents")
    .select(
      "id, tenant_id, lease_id, template_kind, label, storage_key, file_extension, generated_at, signed_at, signature_name"
    )
    .eq("tenant_id", tenantId)
    .order("generated_at", { ascending: false });

  const rows = (data ?? []) as Omit<TenantDocument, "download_url">[];

  // Sign URLs in parallel — short-lived (7 days) for share-via-text use
  const signed = await Promise.all(
    rows.map(async (r) => {
      const { data: s } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(r.storage_key, 60 * 60 * 24 * 7);
      return { ...r, download_url: s?.signedUrl ?? null };
    })
  );
  return signed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation
// ─────────────────────────────────────────────────────────────────────────────

export type GenerateContractInput = {
  tenantId: string;
  templateKind: string;
  /** Optional caller overrides for placeholder values. */
  extraReplacements?: Record<string, string>;
};

export type GenerateContractResult = {
  success: boolean;
  error?: string;
  document_id?: string;
  download_url?: string;
  filled_placeholders?: string[];
  unfilled_placeholders?: string[];
};

/**
 * Pulls a template from contracts/templates/, fills every known
 * placeholder from the tenant + lease + unit + property data, uploads
 * the filled .docx to the tenant's profile under
 *   contracts/<property>/<lease>/<template-kind>/<timestamp>.docx
 * (or contracts/<property>/tenants/<tenant>/<...> if no lease exists),
 * and inserts a tenant_documents row.
 */
export async function generateContractForTenant(
  input: GenerateContractInput
): Promise<GenerateContractResult> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  // Auth gate
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };
  const { data: profile } = await supabase
    .from("users")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || (profile.role !== "owner" && profile.role !== "manager")) {
    return { success: false, error: "Insufficient permissions" };
  }

  // Load template metadata
  const { data: template } = await admin
    .from("contract_templates")
    .select("id, kind, label, storage_key, file_extension, placeholders")
    .eq("kind", input.templateKind)
    .eq("active", true)
    .maybeSingle();
  if (!template) {
    return { success: false, error: `Template '${input.templateKind}' not found` };
  }

  // Load tenant + (optional) active lease + unit + property
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, first_name, last_name, email, phone, emergency_contact_name, emergency_contact_phone, property_id")
    .eq("id", input.tenantId)
    .maybeSingle();
  if (!tenant) return { success: false, error: "Tenant not found" };

  const { data: lease } = await admin
    .from("leases")
    .select("id, unit_id, monthly_rent, security_deposit, start_date, end_date, lease_type")
    .eq("tenant_id", input.tenantId)
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: unit } = lease
    ? await admin
        .from("units")
        .select("id, unit_number, bedrooms, bathrooms, sqft")
        .eq("id", lease.unit_id)
        .maybeSingle()
    : { data: null };

  const { data: property } = await admin
    .from("properties")
    .select("name, address, city, state, zip, owner_entity")
    .eq("id", tenant.property_id)
    .maybeSingle();

  // ── Build replacement dictionary ──────────────────────────────────────
  const fullName = `${tenant.first_name} ${tenant.last_name}`.trim();
  const replacements: Record<string, string> = {
    "[APPLICANT FULL NAME]": fullName,
    "[RESIDENT 1 FULL NAME]": fullName,
    "[RESIDENT 2 FULL NAME]": "—",
    "[APT #]": unit?.unit_number ?? "—",
    "[LANDLORD NOTICE EMAIL]":
      process.env.LANDLORD_NOTICE_EMAIL || "frizzhasit@gmail.com",
    "[EMERGENCY PHONE]":
      tenant.emergency_contact_phone || process.env.LANDLORD_EMERGENCY_PHONE || "—",
    "[RESIDENT NOTICE EMAIL]": tenant.email || "—",
    // Helpful non-bracket-style aliases in case future templates use them
    ...(input.extraReplacements ?? {}),
  };

  // ── Download template ─────────────────────────────────────────────────
  const { data: blob, error: dlErr } = await admin.storage
    .from(BUCKET)
    .download(template.storage_key);
  if (dlErr || !blob) {
    return { success: false, error: `Template download failed: ${dlErr?.message ?? "no blob"}` };
  }
  const buf = Buffer.from(await blob.arrayBuffer());

  // ── Fill ──────────────────────────────────────────────────────────────
  const filled = await fillDocxTemplate(buf, replacements);

  // Determine which placeholders we actually had values for
  const known = (template.placeholders as string[]) ?? [];
  const filledKeys = known.filter(
    (p) => replacements[p] != null && replacements[p] !== "—"
  );
  const unfilledKeys = known.filter((p) => !filledKeys.includes(p));

  // ── Upload to a profile-scoped path ───────────────────────────────────
  const propertyId = tenant.property_id;
  const ts = Date.now();
  const folder = lease
    ? `${propertyId}/${lease.id}/${template.kind}`
    : `${propertyId}/tenants/${tenant.id}/${template.kind}`;
  const key = `${folder}/${ts}.docx`;

  const { error: upErr } = await admin.storage.from(BUCKET).upload(key, filled, {
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: false,
  });
  if (upErr) return { success: false, error: `Upload failed: ${upErr.message}` };

  const label = `${template.label} — ${fullName}${unit ? ` · Unit ${unit.unit_number}` : ""}`;

  // ── tenant_documents row ──────────────────────────────────────────────
  const { data: docRow, error: insErr } = await admin
    .from("tenant_documents")
    .insert({
      tenant_id: tenant.id,
      lease_id: lease?.id ?? null,
      template_id: template.id,
      template_kind: template.kind,
      label,
      storage_key: key,
      file_extension: "docx",
      generated_by: user.id,
      notes:
        unfilledKeys.length > 0
          ? `Unfilled placeholders left for owner/tenant to complete by hand: ${unfilledKeys.join(", ")}`
          : null,
    })
    .select("id")
    .single();
  if (insErr) return { success: false, error: `Doc record insert failed: ${insErr.message}` };

  // Sign a 7-day URL for the response
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(key, 60 * 60 * 24 * 7);

  // Audit log
  try {
    await admin.from("ai_logs").insert({
      agent_name: "contract-generator",
      task_description: `generate_${template.kind}`,
      model_used: "deterministic",
      token_cost: 0,
      status: "succeeded",
      output_data: {
        tenant_id: tenant.id,
        tenant_name: fullName,
        lease_id: lease?.id ?? null,
        unit_id: lease?.unit_id ?? null,
        unit_number: unit?.unit_number ?? null,
        property_id: propertyId,
        property_name: property?.name ?? null,
        template_id: template.id,
        template_kind: template.kind,
        template_label: template.label,
        storage_key: key,
        document_id: docRow.id,
        generated_by: profile.name,
        generated_at: new Date().toISOString(),
        filled_placeholders: filledKeys,
        unfilled_placeholders: unfilledKeys,
      } as Record<string, unknown>,
    });
  } catch {
    /* swallow */
  }

  revalidatePath("/tenants");
  revalidatePath("/units");

  return {
    success: true,
    document_id: docRow.id,
    download_url: signed?.signedUrl ?? undefined,
    filled_placeholders: filledKeys,
    unfilled_placeholders: unfilledKeys,
  };
}
