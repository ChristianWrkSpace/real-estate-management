-- Rent payment tracking with Stripe integration

CREATE TABLE IF NOT EXISTS rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  amount_due numeric(10,2) NOT NULL,
  amount_paid numeric(10,2) DEFAULT 0,
  paid_at timestamptz,
  payment_method text
    CHECK (payment_method IN ('stripe','cash','check','zelle')),
  stripe_payment_intent_id text,
  stripe_payment_link text,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','partial','paid','late','waived')),
  late_fee numeric(10,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rent_payments_due_date_status ON rent_payments(due_date, status);
CREATE INDEX IF NOT EXISTS idx_rent_payments_lease_id ON rent_payments(lease_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_tenant_id ON rent_payments(tenant_id);
