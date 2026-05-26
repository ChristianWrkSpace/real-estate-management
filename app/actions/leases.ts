"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";

const BUCKET = "contracts";

export async function uploadLeaseDocument(
  formData: FormData
): Promise<{ success: boolean; error?: string; url?: string }> {
  const tenantId = formData.get("tenantId");
  const file = formData.get("file");

  if (typeof tenantId !== "string" || !tenantId) {
    return { success: false, error: "tenantId required" };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "No file provided" };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { success: false, error: "File exceeds 20MB" };
  }
  if (
    file.type &&
    !file.type.startsWith("application/pdf") &&
    !file.type.startsWith("image/")
  ) {
    return { success: false, error: "Only PDF or image files are allowed" };
  }

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, property_id, first_name, last_name")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantErr || !tenant) return { success: false, error: "Tenant not found" };

  const { data: lease } = await supabase
    .from("leases")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lease) {
    return { success: false, error: "No active lease for this tenant" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const key = `${tenant.property_id}/${lease.id}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from(BUCKET).upload(key, buffer, {
    upsert: true,
    contentType: file.type || "application/pdf",
  });
  if (upErr) return { success: false, error: `Upload failed: ${upErr.message}` };

  // Signed URL valid for 7 days; we re-sign on demand for fresh links.
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(key, 60 * 60 * 24 * 7);

  const documentUrl = signed?.signedUrl || key;

  const { error: updErr } = await admin
    .from("leases")
    .update({ document_url: documentUrl })
    .eq("id", lease.id);

  if (updErr) return { success: false, error: `DB update failed: ${updErr.message}` };

  revalidatePath("/tenants");
  return { success: true, url: documentUrl };
}

export async function getLeaseDocumentMap(
  tenantIds: string[]
): Promise<Record<string, string | null>> {
  if (tenantIds.length === 0) return {};
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("leases")
    .select("tenant_id, document_url, start_date, status")
    .in("tenant_id", tenantIds)
    .eq("status", "active");

  const map: Record<string, string | null> = {};
  for (const t of tenantIds) map[t] = null;
  for (const row of data ?? []) {
    if (row.document_url) map[row.tenant_id] = row.document_url;
  }
  return map;
}
