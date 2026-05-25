-- Row-level security policies

-- First, extend auth.users with profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  name text,
  role text NOT NULL DEFAULT 'maintenance'
    CHECK (role IN ('owner','manager','maintenance')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION current_user_role() RETURNS text
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE id = auth.uid()),
    'maintenance'
  );
$$;

-- RLS Policies for properties
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_see_all" ON properties FOR SELECT USING (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "owner_insert" ON properties FOR INSERT WITH CHECK (
  current_user_role() = 'owner'
);
CREATE POLICY "owner_update" ON properties FOR UPDATE USING (
  current_user_role() = 'owner'
);
CREATE POLICY "owner_delete" ON properties FOR DELETE USING (
  current_user_role() = 'owner'
);

-- RLS Policies for units
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see_units_if_manager" ON units FOR SELECT USING (
  current_user_role() IN ('owner', 'manager', 'maintenance')
);
CREATE POLICY "manage_units_if_manager" ON units FOR INSERT WITH CHECK (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "update_units_if_manager" ON units FOR UPDATE USING (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "delete_units_if_owner" ON units FOR DELETE USING (
  current_user_role() = 'owner'
);

-- RLS Policies for tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see_tenants_if_manager" ON tenants FOR SELECT USING (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "insert_tenants_if_manager" ON tenants FOR INSERT WITH CHECK (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "update_tenants_if_manager" ON tenants FOR UPDATE USING (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "delete_tenants_if_owner" ON tenants FOR DELETE USING (
  current_user_role() = 'owner'
);

-- RLS Policies for leases
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see_leases_if_manager" ON leases FOR SELECT USING (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "insert_leases_if_manager" ON leases FOR INSERT WITH CHECK (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "update_leases_if_manager" ON leases FOR UPDATE USING (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "delete_leases_if_owner" ON leases FOR DELETE USING (
  current_user_role() = 'owner'
);

-- RLS Policies for rent_payments
ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see_payments_if_manager" ON rent_payments FOR SELECT USING (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "insert_payments_if_manager" ON rent_payments FOR INSERT WITH CHECK (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "update_payments_if_manager" ON rent_payments FOR UPDATE USING (
  current_user_role() IN ('owner', 'manager')
);

-- RLS Policies for contractors and work orders (anyone can see/manage work orders)
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see_contractors_if_manager" ON contractors FOR SELECT USING (
  current_user_role() IN ('owner', 'manager', 'maintenance')
);
CREATE POLICY "manage_contractors_if_manager" ON contractors FOR INSERT WITH CHECK (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "update_contractors_if_manager" ON contractors FOR UPDATE USING (
  current_user_role() IN ('owner', 'manager')
);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see_work_orders" ON work_orders FOR SELECT USING (
  current_user_role() IN ('owner', 'manager', 'maintenance')
);
CREATE POLICY "create_work_orders_if_manager" ON work_orders FOR INSERT WITH CHECK (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "update_work_orders_if_manager" ON work_orders FOR UPDATE USING (
  current_user_role() IN ('owner', 'manager', 'maintenance')
);

ALTER TABLE contractor_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see_payments_if_manager" ON contractor_payments FOR SELECT USING (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "manage_payments_if_owner" ON contractor_payments FOR INSERT WITH CHECK (
  current_user_role() = 'owner'
);
CREATE POLICY "update_payments_if_owner" ON contractor_payments FOR UPDATE USING (
  current_user_role() = 'owner'
);

-- RLS Policies for contracts, expenses, equity, AI tables
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE equity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see_contracts_if_manager" ON contracts FOR SELECT USING (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "manage_contracts_if_manager" ON contracts FOR INSERT WITH CHECK (
  current_user_role() IN ('owner', 'manager')
);

CREATE POLICY "see_expenses_if_manager" ON property_expenses FOR SELECT USING (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "manage_expenses_if_manager" ON property_expenses FOR INSERT WITH CHECK (
  current_user_role() IN ('owner', 'manager')
);

CREATE POLICY "see_equity_if_manager" ON equity_snapshots FOR SELECT USING (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "manage_equity_if_owner" ON equity_snapshots FOR INSERT WITH CHECK (
  current_user_role() = 'owner'
);

-- AI tables: append-only, users can only insert their own invocations
CREATE POLICY "insert_own_invocations" ON agent_invocations FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
CREATE POLICY "see_own_invocations" ON agent_invocations FOR SELECT USING (
  user_id = auth.uid() OR current_user_role() = 'owner'
);

CREATE POLICY "insert_outcomes" ON agent_outcomes FOR INSERT WITH CHECK (true);
CREATE POLICY "see_outcomes_if_owner" ON agent_outcomes FOR SELECT USING (
  current_user_role() = 'owner'
);

CREATE POLICY "see_approvals" ON pending_approvals FOR SELECT USING (
  current_user_role() IN ('owner', 'manager')
);
CREATE POLICY "manage_approvals_if_owner" ON pending_approvals FOR UPDATE USING (
  current_user_role() = 'owner'
);

CREATE POLICY "see_audit_if_owner" ON audit_logs FOR SELECT USING (
  current_user_role() = 'owner'
);
CREATE POLICY "insert_audit" ON audit_logs FOR INSERT WITH CHECK (true);
