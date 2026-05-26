import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getLeaseDocumentMap } from "@/app/actions/leases";
import { getDelinquencyMap } from "@/app/actions/legal";
import TenantsTable, { type TenantRow } from "@/components/TenantsTable";
import type { UnitOption } from "@/components/TenantEditDrawer";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: properties } = await supabase.from("properties").select("id, name").limit(1);
  const property = properties?.[0];

  const { data: tenants = [] } = await supabase
    .from("tenants")
    .select("id, first_name, last_name, email, phone, status")
    .eq("property_id", property?.id || "");

  const { data: unitsData } = await supabase
    .from("units")
    .select("id, unit_number, status")
    .eq("property_id", property?.id || "")
    .order("unit_number");

  const tenantList = tenants ?? [];
  const [leaseDocs, delinquency, leasesRes] = await Promise.all([
    getLeaseDocumentMap(tenantList.map((t) => t.id)),
    getDelinquencyMap(),
    supabase
      .from("leases")
      .select("id, tenant_id, unit_id, monthly_rent, status, start_date")
      .in("tenant_id", tenantList.length > 0 ? tenantList.map((t) => t.id) : ["00000000-0000-0000-0000-000000000000"])
      .eq("status", "active"),
  ]);

  const unitNumberById = new Map(
    (unitsData ?? []).map((u) => [u.id, u.unit_number])
  );

  // Most-recent active lease per tenant
  const leaseByTenant = new Map<string, NonNullable<typeof leasesRes.data>[number]>();
  for (const l of leasesRes.data ?? []) {
    const prior = leaseByTenant.get(l.tenant_id);
    if (!prior || new Date(l.start_date).getTime() > new Date(prior.start_date).getTime()) {
      leaseByTenant.set(l.tenant_id, l);
    }
  }

  const tenantRows: TenantRow[] = tenantList.map((t) => {
    const lease = leaseByTenant.get(t.id);
    const delinq = delinquency[t.id];
    return {
      id: t.id,
      first_name: t.first_name,
      last_name: t.last_name,
      email: t.email,
      phone: t.phone,
      status: t.status,
      active_lease_id: lease?.id ?? null,
      active_lease_unit_id: lease?.unit_id ?? null,
      active_lease_unit_number: lease ? unitNumberById.get(lease.unit_id) ?? null : null,
      active_lease_monthly_rent: lease?.monthly_rent != null ? Number(lease.monthly_rent) : null,
      past_due_amount: delinq?.past_due_amount ?? 0,
      existing_lease_url: leaseDocs[t.id] ?? null,
    };
  });

  const unitOptions: UnitOption[] = (unitsData ?? []).map((u) => ({
    id: u.id,
    unit_number: u.unit_number,
    status: u.status,
  }));

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">Tenants</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {property?.name ?? "Property"} · click any name to edit, generate links, reassign units
            </p>
          </div>
          <a
            href="#"
            className="rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/15 transition hover:from-emerald-600 hover:to-blue-700"
          >
            + Add Tenant
          </a>
        </header>

        <TenantsTable tenants={tenantRows} units={unitOptions} />
      </div>
    </div>
  );
}
