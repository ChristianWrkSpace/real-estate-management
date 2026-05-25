import { createAdminClient } from "./supabase-server";

export type Agent =
  | "argus"
  | "ledger"
  | "esquire"
  | "solomon"
  | "hunter"
  | "extract"
  | "abacus"
  | "echo";

export type Outcome =
  | "approved_unchanged"
  | "approved_with_edits"
  | "rejected"
  | "revised"
  | "corrected";

/**
 * Map a pending_approvals.kind to (agent, task) so the resolution path can
 * log to agent_outcomes without each call site hardcoding the mapping.
 * Returns null if the kind has no AI agent behind it.
 */
export function kindToAgentTask(
  kind: string
): { agent: Agent; task: string } | null {
  switch (kind) {
    case "estimate_draft":
      return { agent: "ledger", task: "estimate_draft" };
    case "legal_doc_draft":
      return { agent: "esquire", task: "legal_doc_draft" };
    case "drying_cert_draft":
      return { agent: "esquire", task: "drying_cert_draft" };
    case "demand_letter_draft":
      return { agent: "esquire", task: "demand_letter_draft" };
    case "invoice_draft":
      return { agent: "abacus", task: "invoice_draft" };
    case "status_suggestion":
      return { agent: "echo", task: "status_suggestion" };
    case "referral_attribution":
      return { agent: "echo", task: "referral_attribution" };
    default:
      return null;
  }
}

export interface AgentOutcomeEntry {
  agent: Agent;
  task: string;
  outcome: Outcome;
  jobId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  model?: string | null;
  delta?: Record<string, unknown> | null;
  userId?: string | null;
}

/**
 * Log an agent outcome. Fire-and-forget — failures are swallowed so a logging
 * issue never breaks the user-facing flow. The whole point is feedback that
 * accumulates silently in the background.
 */
export async function logAgentOutcome(entry: AgentOutcomeEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("agent_outcomes").insert({
      agent: entry.agent,
      task: entry.task,
      outcome: entry.outcome,
      job_id: entry.jobId ?? null,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      model: entry.model ?? null,
      delta: entry.delta ?? {},
      user_id: entry.userId ?? null,
    });
  } catch (err) {
    console.error("[agent-feedback] failed to log outcome:", err);
  }
}

/**
 * Pull the most recent outcomes for a (agent, task) pair so the next draft can
 * use them as in-context examples. Limited to N entries to keep prompts small.
 *
 * Returns oldest → newest so prompts can naturally read them as history.
 */
export async function recentOutcomes(
  agent: Agent,
  task: string,
  limit = 5
): Promise<
  Array<{ outcome: Outcome; delta: Record<string, unknown> | null; created_at: string }>
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_outcomes")
    .select("outcome, delta, created_at")
    .eq("agent", agent)
    .eq("task", task)
    .in("outcome", ["approved_with_edits", "rejected", "revised", "corrected"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.reverse();
}

/**
 * Format past outcomes as a prompt-ready preamble. Drop into the system
 * prompt so the agent learns from prior corrections without retraining.
 *
 * Returns "" when there's no history yet — just no-op.
 */
export async function feedbackPreamble(
  agent: Agent,
  task: string,
  limit = 5
): Promise<string> {
  const past = await recentOutcomes(agent, task, limit);
  if (past.length === 0) return "";

  const examples = past
    .map((o, i) => {
      const note =
        o.outcome === "rejected"
          ? "REJECTED by reviewer"
          : o.outcome === "approved_with_edits"
            ? "APPROVED after human edits"
            : o.outcome === "revised"
              ? "REVISED — original was wrong"
              : "CORRECTED on-site";
      const detail = o.delta && Object.keys(o.delta).length > 0
        ? `\n  Lessons: ${JSON.stringify(o.delta)}`
        : "";
      return `Example ${i + 1} (${note}):${detail}`;
    })
    .join("\n");

  return `\n\n## Prior outcomes for this task (most recent last)\nLearn from these so you don't repeat past mistakes:\n${examples}\n`;
}
