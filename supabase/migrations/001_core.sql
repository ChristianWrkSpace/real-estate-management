-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'maintenance')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL DEFAULT 'Laredo',
  state text NOT NULL DEFAULT 'TX',
  zip text NOT NULL DEFAULT '78040',
  units_count int NOT NULL DEFAULT 4,
  purchase_price numeric(12,2),
  purchase_date date,
  owner_entity text DEFAULT 'Trinity Home Builders LLC',
  mortgage_balance numeric(12,2),
  current_value numeric(12,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create units table
CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_number text NOT NULL,
  bedrooms int,
  bathrooms numeric(3,1),
  sqft int,
  status text NOT NULL DEFAULT 'vacant' CHECK (status IN ('occupied','vacant','maintenance')),
  monthly_rent numeric(10,2),
  notes text,
  auto_actions_paused boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(property_id, unit_number)
);

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  status text DEFAULT 'active' CHECK (status IN ('active','former','prospect')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create leases table
CREATE TABLE IF NOT EXISTS leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  monthly_rent numeric(10,2) NOT NULL,
  security_deposit numeric(10,2),
  deposit_held numeric(10,2),
  lease_type text DEFAULT 'fixed' CHECK (lease_type IN ('fixed','month-to-month')),
  status text DEFAULT 'active' CHECK (status IN ('active','expired','terminated')),
  stripe_customer_id text,
  document_path text,
  auto_actions_paused boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Owner and Manager can view all properties"
  ON properties FOR SELECT
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

CREATE POLICY "Owner and Manager can view all units"
  ON units FOR SELECT
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

CREATE POLICY "Owner and Manager can view all tenants"
  ON tenants FOR SELECT
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

CREATE POLICY "Owner and Manager can view all leases"
  ON leases FOR SELECT
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

-- Allow creates
CREATE POLICY "Owner and Manager can create properties"
  ON properties FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

CREATE POLICY "Owner and Manager can create units"
  ON units FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

CREATE POLICY "Owner and Manager can create tenants"
  ON tenants FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

CREATE POLICY "Owner and Manager can create leases"
  ON leases FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

-- Allow updates
CREATE POLICY "Owner and Manager can update properties"
  ON properties FOR UPDATE USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

CREATE POLICY "Owner and Manager can update units"
  ON units FOR UPDATE USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

CREATE POLICY "Owner and Manager can update tenants"
  ON tenants FOR UPDATE USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

CREATE POLICY "Owner and Manager can update leases"
  ON leases FOR UPDATE USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_properties_owner_entity ON properties(owner_entity);
CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);
CREATE INDEX IF NOT EXISTS idx_tenants_property_id ON tenants(property_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_leases_unit_id ON leases(unit_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(status);
