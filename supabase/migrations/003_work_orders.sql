-- Work orders and contractor management

CREATE TABLE IF NOT EXISTS contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  company_name text,
  contact_name text NOT NULL,
  phone text,
  email text,
  specialty text,
  rate_type text DEFAULT 'hourly'
    CHECK (rate_type IN ('hourly','flat','bid')),
  hourly_rate numeric(8,2),
  notes text,
  is_preferred boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  contractor_id uuid REFERENCES contractors(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text,
  priority text DEFAULT 'normal'
    CHECK (priority IN ('urgent','high','normal','low')),
  status text DEFAULT 'open'
    CHECK (status IN ('open','assigned','in_progress','completed','cancelled')),
  estimated_cost numeric(10,2),
  actual_cost numeric(10,2),
  scheduled_at timestamptz,
  completed_at timestamptz,
  auto_actions_paused boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contractor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  payment_method text
    CHECK (payment_method IN ('check','stripe','zelle','cash')),
  stripe_transfer_id text,
  paid_at timestamptz,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','paid','voided')),
  invoice_path text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contractors_property_id ON contractors(property_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_property_id ON work_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_contractor_payments_work_order_id ON contractor_payments(work_order_id);
