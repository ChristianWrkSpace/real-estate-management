-- Property expenses and financial tracking

CREATE TABLE IF NOT EXISTS property_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  category text NOT NULL
    CHECK (category IN ('mortgage','insurance','taxes','utilities','maintenance','landscaping','management','other')),
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  expense_date date NOT NULL,
  is_recurring boolean DEFAULT false,
  recurrence text
    CHECK (recurrence IS NULL OR recurrence IN ('monthly','quarterly','annual')),
  vendor text,
  receipt_path text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_expenses_property_id ON property_expenses(property_id);
CREATE INDEX IF NOT EXISTS idx_property_expenses_date ON property_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_property_expenses_category ON property_expenses(category);
