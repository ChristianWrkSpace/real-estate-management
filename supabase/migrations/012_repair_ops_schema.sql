-- Repairs vendors + work_orders schemas where prior CREATE-IF-NOT-EXISTS
-- statements no-op'd against pre-existing partial tables.
-- Idempotent — safe to re-run.

-- ── vendors: add missing columns + FK + indexes ──────────────────────────────
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS property_id uuid;

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$ BEGIN
  ALTER TABLE vendors
    ADD CONSTRAINT vendors_property_id_fkey
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_foreign_key THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendors_property_id ON vendors(property_id);
CREATE INDEX IF NOT EXISTS idx_vendors_trade ON vendors(trade);

-- ── work_orders: add missing columns + FKs + indexes ─────────────────────────
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS property_id uuid;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS contractor_id uuid;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS auto_actions_paused boolean DEFAULT false;

DO $$ BEGIN
  ALTER TABLE work_orders
    ADD CONSTRAINT work_orders_property_id_fkey
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_foreign_key THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE work_orders
    ADD CONSTRAINT work_orders_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_foreign_key THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_work_orders_property_id ON work_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_vendor_id ON work_orders(vendor_id);

-- ── Force PostgREST to refresh its schema cache so the new columns are
--    visible without restarting the API.
NOTIFY pgrst, 'reload schema';
