"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";
import { fillDocxTemplate } from "@/lib/contract-templates";

const BUCKET = "contracts";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
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

/**
 * Build the {[BRACKET]: value} dict that the system can auto-fill from
 * the tenant + lease + property profile. Returns the dict plus the list
 * of remaining bracket tokens the applicant still needs to provide.
 */
async function buildPrefillContext(args: {
  tenantId: string;
  placeholders: string[];
}): Promise<{
  prefilled: Record<string, string>;
  required: string[];
  tenant: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    emergency_contact_phone: string | null;
    property_id: string;
  };
  lease: {
    id: string;
    unit_id: string;
    monthly_rent: number | null;
    security_deposit: number | null;
    start_date: string;
    end_date: string | null;
  } | null;
  unit: { unit_number: string; bedrooms: number | null; bathrooms: number | null } | null;
  property: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    owner_entity: string | null;
  };
}> {
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select(
      "id, first_name, last_name, email, phone, emergency_contact_phone, property_id"
    )
    .eq("id", args.tenantId)
    .maybeSingle();
  if (!tenant) throw new Error("Tenant not found");

  const { data: lease } = await admin
    .from("leases")
    .select("id, unit_id, monthly_rent, security_deposit, start_date, end_date")
    .eq("tenant_id", args.tenantId)
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: unit } = lease
    ? await admin
        .from("units")
        .select("unit_number, bedrooms, bathrooms")
        .eq("id", lease.unit_id)
        .maybeSingle()
    : { data: null };

  const { data: property } = await admin
    .from("properties")
    .select("name, address, city, state, zip, owner_entity")
    .eq("id", tenant.property_id)
    .maybeSingle();
  if (!property) throw new Error("Property not found");

  const fullName = `${tenant.first_name} ${tenant.last_name}`.trim();
  const prefilled: Record<string, string> = {
    "[APPLICANT FULL NAME]": fullName,
    "[RESIDENT 1 FULL NAME]": fullName,
    "[APT #]": unit?.unit_number ?? "",
    "[LANDLORD NOTICE EMAIL]":
      process.env.LANDLORD_NOTICE_EMAIL || "frizzhasit@gmail.com",
    "[RESIDENT NOTICE EMAIL]": tenant.email ?? "",
    "[EMERGENCY PHONE]":
      tenant.emergency_contact_phone ||
      process.env.LANDLORD_EMERGENCY_PHONE ||
      "",
  };

  // Filter to only the keys this template actually needs, and drop empty
  // strings so they fall through to "required" instead.
  const effectivePrefill: Record<string, string> = {};
  for (const p of args.placeholders) {
    const v = prefilled[p];
    if (v && v.trim()) effectivePrefill[p] = v;
  }

  const required = args.placeholders.filter((p) => !effectivePrefill[p]);

  return {
    prefilled: effectivePrefill,
    required,
    tenant: tenant as never,
    lease: lease ?? null,
    unit: unit ?? null,
    property: property as never,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner-side: mint a signing request
// ─────────────────────────────────────────────────────────────────────────────

export type CreateSigningRequestInput = {
  tenantId: string;
  templateKind: string;
};

export type CreateSigningRequestResult = {
  success: boolean;
  error?: string;
  url?: string;
  request_id?: string;
  required_fields?: string[];
  prefilled_count?: number;
};

export async function createSigningRequest(
  input: CreateSigningRequestInput
): Promise<CreateSigningRequestResult> {
  const auth = await requireOwnerOrManager();
  if (!auth.ok) return { success: false, error: auth.error };

  const admin = createAdminClient();

  const { data: template } = await admin
    .from("contract_templates")
    .select("id, kind, label, placeholders")
    .eq("kind", input.templateKind)
    .eq("active", true)
    .maybeSingle();
  if (!template) {
    return { success: false, error: `Template '${input.templateKind}' not found` };
  }

  let context;
  try {
    context = await buildPrefillContext({
      tenantId: input.tenantId,
      placeholders: (template.placeholders as string[]) ?? [],
    });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }

  const token = randomBytes(24).toString("base64url");

  const { data: row, error } = await admin
    .from("contract_signing_requests")
    .insert({
      token,
      tenant_id: input.tenantId,
      lease_id: context.lease?.id ?? null,
      template_id: template.id,
      template_kind: template.kind,
      template_label: template.label,
      prefilled_fields: context.prefilled,
      required_fields: context.required,
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  // Audit
  try {
    await admin.from("ai_logs").insert({
      agent_name: "signing-request",
      task_description: "create_signing_request",
      model_used: "deterministic",
      token_cost: 0,
      status: "succeeded",
      output_data: {
        request_id: row.id,
        token_preview: token.slice(0, 8) + "…",
        tenant_id: input.tenantId,
        template_kind: input.templateKind,
        prefilled_keys: Object.keys(context.prefilled),
        required_keys: context.required,
        created_by: auth.profile.name,
      } as Record<string, unknown>,
    });
  } catch {
    /* swallow */
  }

  revalidatePath("/tenants");

  return {
    success: true,
    request_id: row.id,
    url: `${origin}/sign/${token}`,
    required_fields: context.required,
    prefilled_count: Object.keys(context.prefilled).length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: load a signing context for the /sign/<token> page
// ─────────────────────────────────────────────────────────────────────────────

export type SigningContext = {
  request_id: string;
  template_kind: string;
  template_label: string;
  status: string;
  expires_at: string;
  tenant_name: string;
  tenant_email: string | null;
  property_name: string;
  property_full_address: string;
  prefilled: Record<string, string>;
  required_fields: string[];
};

export async function getSigningContext(token: string): Promise<SigningContext | null> {
  if (!token) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_signing_request_by_token", {
    p_token: token,
  });
  if (error || !data || data.length === 0) return null;
  const r = data[0];
  return {
    request_id: r.id,
    template_kind: r.template_kind,
    template_label: r.template_label ?? r.template_kind,
    status: r.status,
    expires_at: r.expires_at,
    tenant_name: `${r.tenant_first_name} ${r.tenant_last_name}`.trim(),
    tenant_email: r.tenant_email,
    property_name: r.property_name,
    property_full_address: r.property_full_address,
    prefilled: (r.prefilled_fields as Record<string, string>) ?? {},
    required_fields: (r.required_fields as string[]) ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: submit the signed contract
// ─────────────────────────────────────────────────────────────────────────────

export type SubmitSignedInput = {
  token: string;
  fieldValues: Record<string, string>;
  signatureName: string;
  acceptedTerms: boolean;
};

export type SubmitSignedResult = {
  success: boolean;
  error?: string;
  document_id?: string;
  download_url?: string;
};

export async function submitSignedContract(
  input: SubmitSignedInput
): Promise<SubmitSignedResult> {
  if (!input.token) return { success: false, error: "Missing token" };
  if (!input.signatureName?.trim()) {
    return { success: false, error: "Type your full legal name to sign" };
  }
  if (!input.acceptedTerms) {
    return { success: false, error: "You must accept the terms to sign" };
  }

  const admin = createAdminClient();

  // Load the signing request (must be pending + non-expired). RPC enforces that.
  const ctx = await getSigningContext(input.token);
  if (!ctx) {
    return {
      success: false,
      error: "This signing link is invalid, expired, or already used.",
    };
  }

  // Validate every required field has a value (trimmed)
  const fieldValues = input.fieldValues || {};
  const missing = ctx.required_fields.filter((k) => !fieldValues[k]?.trim());
  if (missing.length > 0) {
    return {
      success: false,
      error: `Please fill: ${missing.join(", ")}`,
    };
  }

  // ── Fetch the template binary ────────────────────────────────────────
  const { data: template } = await admin
    .from("contract_templates")
    .select("id, kind, label, storage_key, file_extension")
    .eq("kind", ctx.template_kind)
    .maybeSingle();
  if (!template) {
    return { success: false, error: "Template missing" };
  }

  const { data: blob, error: dlErr } = await admin.storage
    .from(BUCKET)
    .download(template.storage_key);
  if (dlErr || !blob) {
    return { success: false, error: `Template download failed: ${dlErr?.message}` };
  }
  const buf = Buffer.from(await blob.arrayBuffer());

  // Merge prefilled + applicant-submitted values
  const allReplacements: Record<string, string> = {
    ...ctx.prefilled,
    ...Object.fromEntries(
      Object.entries(fieldValues).map(([k, v]) => [k, (v ?? "").trim()])
    ),
  };

  // ── Fill the docx ────────────────────────────────────────────────────
  const filled = await fillDocxTemplate(buf, allReplacements);

  // ── Determine ownership context for the storage path ─────────────────
  const { data: req } = await admin
    .from("contract_signing_requests")
    .select("tenant_id, lease_id, template_id")
    .eq("token", input.token)
    .maybeSingle();
  if (!req) return { success: false, error: "Signing request vanished" };

  const { data: tenant } = await admin
    .from("tenants")
    .select("property_id")
    .eq("id", req.tenant_id)
    .maybeSingle();
  if (!tenant) return { success: false, error: "Tenant vanished" };

  // ── Upload signed copy ───────────────────────────────────────────────
  const ts = Date.now();
  const folder = req.lease_id
    ? `${tenant.property_id}/${req.lease_id}/${template.kind}`
    : `${tenant.property_id}/tenants/${req.tenant_id}/${template.kind}`;
  const key = `${folder}/signed-${ts}.docx`;

  const { error: upErr } = await admin.storage.from(BUCKET).upload(key, filled, {
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: false,
  });
  if (upErr) {
    return { success: false, error: `Upload failed: ${upErr.message}` };
  }

  const sigName = input.signatureName.trim();
  const sigIp =
    (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const signedAt = new Date().toISOString();

  // ── Insert into tenant_documents with signature metadata ────────────
  const { data: doc, error: docErr } = await admin
    .from("tenant_documents")
    .insert({
      tenant_id: req.tenant_id,
      lease_id: req.lease_id,
      template_id: template.id,
      template_kind: template.kind,
      label: `${template.label} — ${ctx.tenant_name} (signed)`,
      storage_key: key,
      file_extension: "docx",
      signed_at: signedAt,
      signature_name: sigName,
      signature_ip: sigIp,
      notes: `E-signed via /sign/${input.token.slice(0, 8)}…. ${Object.keys(
        fieldValues
      ).length} applicant-supplied fields.`,
    })
    .select("id")
    .single();
  if (docErr) return { success: false, error: `Doc record failed: ${docErr.message}` };

  // ── Mark request signed + link generated doc ─────────────────────────
  await admin
    .from("contract_signing_requests")
    .update({
      status: "signed",
      signed_at: signedAt,
      signature_name: sigName,
      signature_ip: sigIp,
      submitted_field_values: fieldValues,
      generated_document_id: doc.id,
    })
    .eq("token", input.token);

  // Signed 7-day URL for the response
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(key, 60 * 60 * 24 * 7);

  // Audit
  try {
    await admin.from("ai_logs").insert({
      agent_name: "signing-request",
      task_description: "submit_signed_contract",
      model_used: "deterministic",
      token_cost: 0,
      status: "succeeded",
      output_data: {
        request_id: ctx.request_id,
        document_id: doc.id,
        tenant_id: req.tenant_id,
        template_kind: template.kind,
        signed_by: sigName,
        signed_at: signedAt,
        signature_ip: sigIp,
        storage_key: key,
        prefilled_keys: Object.keys(ctx.prefilled),
        applicant_keys: Object.keys(fieldValues),
      } as Record<string, unknown>,
    });
  } catch {
    /* swallow */
  }

  revalidatePath("/tenants");
  revalidatePath("/contracts");

  return {
    success: true,
    document_id: doc.id,
    download_url: signed?.signedUrl ?? undefined,
  };
}
