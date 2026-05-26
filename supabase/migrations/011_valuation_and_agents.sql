-- Sprint 3 + 4: Valuation, Lease Vault, AI Agent Logs
-- Idempotent — safe to re-run.

-- ── properties: valuation columns ────────────────────────────────────────────
-- current_value + mortgage_balance already exist in 001_core; only add new.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS interest_rate numeric(6,4);

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS last_appraisal_date timestamptz;

-- ── leases: PDF vault link ───────────────────────────────────────────────────
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS document_url text;

-- ── ai_logs: every agent invocation ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  task_description text,
  model_used text,
  token_cost numeric(10,6) DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','succeeded','failed')),
  output_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_agent_created
  ON ai_logs(agent_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_status
  ON ai_logs(status);

ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner and Manager can view ai_logs" ON public.ai_logs;
CREATE POLICY "Owner and Manager can view ai_logs"
  ON public.ai_logs FOR SELECT
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager')));

DROP POLICY IF EXISTS "Owner and Manager can insert ai_logs" ON public.ai_logs;
CREATE POLICY "Owner and Manager can insert ai_logs"
  ON public.ai_logs FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager')));
