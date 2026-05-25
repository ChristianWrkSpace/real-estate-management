-- Equity tracking and monthly snapshots

CREATE TABLE IF NOT EXISTS equity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  property_value numeric(12,2) NOT NULL,
  mortgage_balance numeric(12,2) NOT NULL,
  equity numeric(12,2) GENERATED ALWAYS AS (property_value - mortgage_balance) STORED,
  loan_to_value numeric(6,4) GENERATED ALWAYS AS (mortgage_balance / NULLIF(property_value,0)) STORED,
  gross_rent_income numeric(10,2),
  total_expenses numeric(10,2),
  net_operating_income numeric(10,2) GENERATED ALWAYS AS (gross_rent_income - total_expenses) STORED,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (property_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_equity_snapshots_property_id ON equity_snapshots(property_id);
CREATE INDEX IF NOT EXISTS idx_equity_snapshots_date ON equity_snapshots(snapshot_date);
