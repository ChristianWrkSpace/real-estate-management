// Auto-actions foundation. Server-only.
//
// Pattern: agents auto-DRAFT entities, then call enqueueApproval() to surface
// the draft in the office's notification inbox. Hard rule: never call this
// for anything that auto-sends or auto-charges. Drafts only.
//
// Suppression: respects per-job `jobs.auto_actions_paused` flag. Callers
// should check via isAutoPaused() before doing the AI / DB write.

import { createAdminClient } from "./supabase-server";

export type ApprovalKind =
  | "estimate_draft"
  | "legal_doc_draft"
  | "invoice_draft"
  | "drying_cert_draft"
  | "demand_letter_draft"
  | "status_suggestion"
  | "referral_attribution";

export interface EnqueueArgs {
  kind: ApprovalKind;
  jobId: string;
  entityType?: string;
  entityId?: string;
  title: string;
  detail?: string;
  link?: string;
  metadata?: Record<string, any>;
}

/**
 * Returns true if auto-actions are paused on this job. Always check before
 * calling an AI agent or creating a draft, so we don't waste compute or
 * surprise the office on a litigated/hostile claim.
 */
export async function isAutoPaused(jobId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("jobs")
      .select("auto_actions_paused")
      .eq("id", jobId)
      .single();
    return !!data?.auto_actions_paused;
  } catch {
    // If we can't check, fail closed (treat as paused) — safer.
    return true;
  }
}

/**
 * Has this exact kind already been enqueued for this job? Used to prevent
 * spam (e.g., re-firing the AOB draft on every save). Not a strict dedupe —
 * if the user dismissed/rejected, they may want a fresh one later.
 */
export async function alreadyEnqueued(
  jobId: string,
  kind: ApprovalKind
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("pending_approvals")
      .select("id")
      .eq("job_id", jobId)
      .eq("kind", kind)
      .in("status", ["pending", "approved"])
      .limit(1);
    return (data ?? []).length > 0;
  } catch {
    return false;
  }
}

export async function enqueueApproval(args: EnqueueArgs): Promise<{ id: string } | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("pending_approvals")
      .insert({
        kind: args.kind,
        job_id: args.jobId,
        entity_type: args.entityType ?? null,
        entity_id: args.entityId ?? null,
        title: args.title,
        detail: args.detail ?? null,
        link: args.link ?? null,
        source: "system",
        status: "pending",
        metadata: args.metadata ?? {},
      })
      .select("id")
      .single();
    if (error) {
      console.error("[auto-actions.enqueue]", error.message);
      return null;
    }
    return data;
  } catch (err: any) {
    console.error("[auto-actions.enqueue]", err?.message ?? err);
    return null;
  }
}

/**
 * When the user takes the underlying action (approves an estimate, marks
 * a legal doc signed, etc.), find any matching pending_approvals and mark
 * them resolved as 'approved'. Fire-and-forget.
 */
export async function resolveApprovalsForEntity(
  entityType: string,
  entityId: string,
  resolvedByUserId: string | null = null,
  notes?: string
) {
  try {
    const admin = createAdminClient();
    await admin
      .from("pending_approvals")
      .update({
        status: "approved",
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedByUserId,
        resolution_notes: notes ?? null,
      })
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("status", "pending");
  } catch (err: any) {
    console.error("[auto-actions.resolve]", err?.message ?? err);
  }
}
