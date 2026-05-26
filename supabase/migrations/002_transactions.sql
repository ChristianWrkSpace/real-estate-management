-- Create transactions table (unified income + expense tracking)
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  description text,
  receipt_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_property_date ON transactions(property_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_property_type ON transactions(property_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_property_category ON transactions(property_id, category);

-- RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner and Manager can view all transactions"
  ON transactions FOR SELECT
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

CREATE POLICY "Owner and Manager can create transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

CREATE POLICY "Owner and Manager can update transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

CREATE POLICY "Owner and Manager can delete transactions"
  ON transactions FOR DELETE
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));
