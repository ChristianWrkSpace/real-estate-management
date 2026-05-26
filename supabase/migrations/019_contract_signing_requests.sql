-- E-signature signing requests
-- One row per signing link minted by the owner/manager. Public token used to
-- access the /sign/<token> page; RPC enforces pending + non-expired status so
-- we can keep RLS strict on the underlying table.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.contract_signing_requests (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token                    text NOT NULL UNIQUE,
  tenant_id                uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lease_id                 uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  template_id              uuid NOT NULL REFERENCES public.contract_templates(id) ON DELETE RESTRICT,
  template_kind            text NOT NULL,
  template_label           text,
  prefilled_fields         jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_fields          jsonb NOT NULL DEFAULT '[]'::jsonb,
  status                   text NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'signed', 'expired', 'revoked')),
  created_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  expires_at               timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  signed_at                timestamptz,
  signature_name           text,
  signature_ip             text,
  submitted_field_values   jsonb,
  generated_document_id    uuid REFERENCES public.tenant_documents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_csr_tenant ON public.contract_signing_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_csr_status ON public.contract_signing_requests(status);

ALTER TABLE public.contract_signing_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner/manager full access to signing requests"
  ON public.contract_signing_requests;
CREATE POLICY "Owner/manager full access to signing requests"
  ON public.contract_signing_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('owner', 'manager')
    )
  );

-- Public read by token (pending + non-expired only). Keeps RLS strict on the
-- table itself; the /sign/<token> page calls this SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION public.get_signing_request_by_token(p_token text)
RETURNS TABLE (
  id                      uuid,
  template_kind           text,
  template_label          text,
  status                  text,
  expires_at              timestamptz,
  tenant_first_name       text,
  tenant_last_name        text,
  tenant_email            text,
  property_name           text,
  property_full_address   text,
  prefilled_fields        jsonb,
  required_fields         jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.template_kind,
    r.template_label,
    r.status,
    r.expires_at,
    t.first_name      AS tenant_first_name,
    t.last_name       AS tenant_last_name,
    t.email           AS tenant_email,
    p.name            AS property_name,
    (p.address || ', ' || p.city || ', ' || p.state || ' ' || p.zip)
                      AS property_full_address,
    r.prefilled_fields,
    r.required_fields
  FROM public.contract_signing_requests r
  JOIN public.tenants    t ON t.id = r.tenant_id
  JOIN public.properties p ON p.id = t.property_id
  WHERE r.token = p_token
    AND r.status = 'pending'
    AND r.expires_at > now()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_signing_request_by_token(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
