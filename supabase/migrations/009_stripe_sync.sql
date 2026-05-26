-- Sprint 1: Stripe sync columns
-- Adds stripe_customer_id to tenants and stripe_price_id to units.
-- Idempotent: safe to re-run.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer_id
  ON tenants(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_units_stripe_price_id
  ON units(stripe_price_id);

-- Track raw Stripe events so the webhook is idempotent under retries.
CREATE TABLE IF NOT EXISTS stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz DEFAULT now()
);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Owner can view stripe events"
    ON stripe_events FOR SELECT
    USING (auth.uid() IN (SELECT id FROM users WHERE role = 'owner'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
