-- Tenant onboarding pipeline columns
-- Idempotent — safe to re-run.

-- ── leases: onboarding token + digital signature audit ─────────────────────
ALTER TABLE leases ADD COLUMN IF NOT EXISTS onboarding_token text;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS onboarding_sent_at timestamptz;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS signature_name text;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS signature_ip text;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS payment_link_url text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leases_onboarding_token
  ON leases(onboarding_token)
  WHERE onboarding_token IS NOT NULL;

-- Allow the public /onboard/[lease_id] route to read a single lease row
-- only when the caller knows its onboarding_token. Done via a SECURITY
-- DEFINER function rather than relaxing RLS on leases.
CREATE OR REPLACE FUNCTION public.get_lease_for_onboarding(p_token text)
RETURNS TABLE (
  lease_id uuid,
  tenant_id uuid,
  unit_id uuid,
  property_id uuid,
  monthly_rent numeric,
  security_deposit numeric,
  start_date date,
  end_date date,
  lease_type text,
  status text,
  signed_at timestamptz,
  tenant_first_name text,
  tenant_last_name text,
  tenant_email text,
  tenant_phone text,
  unit_number text,
  bedrooms int,
  bathrooms numeric,
  sqft int,
  property_name text,
  property_address text,
  property_city text,
  property_state text,
  property_zip text,
  owner_entity text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id          AS lease_id,
    l.tenant_id,
    l.unit_id,
    t.property_id,
    l.monthly_rent,
    l.security_deposit,
    l.start_date,
    l.end_date,
    l.lease_type,
    l.status,
    l.signed_at,
    t.first_name  AS tenant_first_name,
    t.last_name   AS tenant_last_name,
    t.email       AS tenant_email,
    t.phone       AS tenant_phone,
    u.unit_number,
    u.bedrooms,
    u.bathrooms,
    u.sqft,
    p.name        AS property_name,
    p.address     AS property_address,
    p.city        AS property_city,
    p.state       AS property_state,
    p.zip         AS property_zip,
    p.owner_entity
  FROM leases l
  JOIN tenants t ON t.id = l.tenant_id
  JOIN units u   ON u.id = l.unit_id
  JOIN properties p ON p.id = t.property_id
  WHERE l.onboarding_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_lease_for_onboarding(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
