-- ONE-SHOT FINAL REPAIR — paste this whole file into the Supabase SQL Editor.
-- Every statement is independently safe (IF NOT EXISTS / DROP IF EXISTS).
-- Recreates the transactions table and the missing ops columns, then
-- forces PostgREST to reload its schema cache.

-- ─────────────────────────────────────────────────────────────────────
-- transactions (P&L ledger)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('income','expense')),
  category text NOT NULL,
  description text,
  receipt_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_property_date  ON transactions(property_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_property_type  ON transactions(property_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_property_cat   ON transactions(property_id, category);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner and Manager can view all transactions"   ON public.transactions;
CREATE POLICY "Owner and Manager can view all transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager')));

DROP POLICY IF EXISTS "Owner and Manager can create transactions"     ON public.transactions;
CREATE POLICY "Owner and Manager can create transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager')));

DROP POLICY IF EXISTS "Owner and Manager can update transactions"     ON public.transactions;
CREATE POLICY "Owner and Manager can update transactions"
  ON public.transactions FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager')));

DROP POLICY IF EXISTS "Owner and Manager can delete transactions"     ON public.transactions;
CREATE POLICY "Owner and Manager can delete transactions"
  ON public.transactions FOR DELETE
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager')));

-- ─────────────────────────────────────────────────────────────────────
-- vendors — backfill missing columns
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS property_id uuid;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_vendors_property_id ON vendors(property_id);

-- ─────────────────────────────────────────────────────────────────────
-- work_orders — backfill missing columns
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS property_id uuid;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS contractor_id uuid;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS auto_actions_paused boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_work_orders_property_id ON work_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status      ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_vendor_id   ON work_orders(vendor_id);

-- ─────────────────────────────────────────────────────────────────────
-- Force PostgREST to refresh its schema cache so the new columns and
-- the recreated transactions table become visible to the API.
-- ─────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
