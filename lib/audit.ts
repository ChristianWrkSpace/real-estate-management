import { createAdminClient } from "./supabase-server";
import type { AuthedUser } from "./auth-helpers";

export interface AuditEntry {
  user: AuthedUser | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: Record<string, any>;
  ip_address?: string | null;
}

/**
 * Log a sensitive action. Fire-and-forget (no await needed at call site).
 * Failures are swallowed so audit issues never break user flows.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      user_id: entry.user?.id ?? null,
      user_name: entry.user?.name ?? null,
      action: entry.action,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      details: entry.details ?? {},
      ip_address: entry.ip_address ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to log:", err);
  }
}
