-- Sprint 2: Operations engine — vendors + extended work_orders
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  trade text,
  phone text,
  email text,
  billing_rate numeric(10,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_property_id ON vendors(property_id);
CREATE INDEX IF NOT EXISTS idx_vendors_trade ON vendors(trade);

-- Extend existing work_orders to support the v2 ops flow.
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL;

-- Allow 'resolved' status alongside the existing 'completed'.
ALTER TABLE work_orders
  DROP CONSTRAINT IF EXISTS work_orders_status_check;
ALTER TABLE work_orders
  ADD CONSTRAINT work_orders_status_check
  CHECK (status IN ('open','assigned','in_progress','resolved','completed','cancelled'));

-- Allow 'medium' priority alongside the existing 'normal'.
ALTER TABLE work_orders
  DROP CONSTRAINT IF EXISTS work_orders_priority_check;
ALTER TABLE work_orders
  ADD CONSTRAINT work_orders_priority_check
  CHECK (priority IN ('urgent','high','medium','normal','low'));

CREATE INDEX IF NOT EXISTS idx_work_orders_vendor_id ON work_orders(vendor_id);

-- RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner and Manager can view vendors" ON public.vendors;
CREATE POLICY "Owner and Manager can view vendors"
  ON public.vendors FOR SELECT
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager')));

DROP POLICY IF EXISTS "Owner and Manager can create vendors" ON public.vendors;
CREATE POLICY "Owner and Manager can create vendors"
  ON public.vendors FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager')));

DROP POLICY IF EXISTS "Owner and Manager can update vendors" ON public.vendors;
CREATE POLICY "Owner and Manager can update vendors"
  ON public.vendors FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager')));

DROP POLICY IF EXISTS "Owner can delete vendors" ON public.vendors;
CREATE POLICY "Owner can delete vendors"
  ON public.vendors FOR DELETE
  USING (auth.uid() IN (SELECT id FROM users WHERE role = 'owner'));

-- Tighten work_orders policies for the v2 flow.
DROP POLICY IF EXISTS "Owner and Manager can view work_orders" ON public.work_orders;
CREATE POLICY "Owner and Manager can view work_orders"
  ON public.work_orders FOR SELECT
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager','maintenance')));

DROP POLICY IF EXISTS "Owner and Manager can create work_orders" ON public.work_orders;
CREATE POLICY "Owner and Manager can create work_orders"
  ON public.work_orders FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager')));

DROP POLICY IF EXISTS "Owner and Manager can update work_orders" ON public.work_orders;
CREATE POLICY "Owner and Manager can update work_orders"
  ON public.work_orders FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager','maintenance')));
