-- Argus-CAD: Webb County tax intelligence schema
-- Idempotent — safe to re-run.

-- ── properties: live tax snapshot ────────────────────────────────────────────
ALTER TABLE properties ADD COLUMN IF NOT EXISTS cad_account_number text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS assessed_market_value numeric(12,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS assessed_taxable_value numeric(12,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tax_levy_current_year numeric(12,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS protest_deadline date;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS cad_last_synced_at timestamptz;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS cad_source_url text;

-- ── property_tax_history: append-only audit trail of every sync ──────────────
CREATE TABLE IF NOT EXISTS property_tax_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  synced_at timestamptz NOT NULL DEFAULT now(),
  tax_year int,
  assessed_market_value numeric(12,2),
  assessed_taxable_value numeric(12,2),
  tax_levy numeric(12,2),
  protest_deadline date,
  cad_account_number text,
  source_url text,
  raw_html_excerpt text,
  parsed_by_model text,
  parse_cost_usd numeric(10,6) DEFAULT 0,
  delta_market_value numeric(12,2),
  delta_taxable_value numeric(12,2),
  delta_tax_levy numeric(12,2),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_property_tax_history_property_synced
  ON property_tax_history(property_id, synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_tax_history_tax_year
  ON property_tax_history(property_id, tax_year DESC);

ALTER TABLE property_tax_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner and Manager can view tax history" ON public.property_tax_history;
CREATE POLICY "Owner and Manager can view tax history"
  ON public.property_tax_history FOR SELECT
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager')));

DROP POLICY IF EXISTS "Owner and Manager can insert tax history" ON public.property_tax_history;
CREATE POLICY "Owner and Manager can insert tax history"
  ON public.property_tax_history FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager')));

NOTIFY pgrst, 'reload schema';
