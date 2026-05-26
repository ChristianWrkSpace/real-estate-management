-- Minimal, foolproof column repair for vendors + work_orders.
-- Run this in Supabase SQL Editor. Every statement is independent
-- and uses IF NOT EXISTS — safe to run multiple times.

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS property_id uuid;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS property_id uuid;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS contractor_id uuid;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS auto_actions_paused boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_vendors_property_id ON vendors(property_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_property_id ON work_orders(property_id);

NOTIFY pgrst, 'reload schema';
