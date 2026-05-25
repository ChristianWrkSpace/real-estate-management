-- Contract management and storage

CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  contractor_id uuid REFERENCES contractors(id) ON DELETE SET NULL,
  contract_type text NOT NULL
    CHECK (contract_type IN ('lease','vendor','utility','insurance','hoa','other')),
  title text NOT NULL,
  parties text,
  start_date date,
  end_date date,
  auto_renews boolean DEFAULT false,
  renewal_notice_days int DEFAULT 30,
  monthly_value numeric(10,2),
  document_path text,
  status text DEFAULT 'active'
    CHECK (status IN ('active','expired','terminated','draft')),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_property_id ON contracts(property_id);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(contract_type);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- Storage bucket setup done via dashboard
