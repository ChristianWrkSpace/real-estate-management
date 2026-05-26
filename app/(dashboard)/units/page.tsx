import { createServerSupabaseClient } from "@/lib/supabase-server";
import UnitsGrid from "@/components/UnitsGrid";
import type { UnitDrawerData } from "@/components/UnitEditDrawer";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: properties } = await supabase.from("properties").select("id, name").limit(1);
  const property = properties?.[0];

  const { data: unitsData } = await supabase
    .from("units")
    .select("id, unit_number, monthly_rent, bedrooms, bathrooms, sqft, status, notes")
    .eq("property_id", property?.id || "")
    .order("unit_number");
  const units = unitsData ?? [];

  const { data: leasesData } = await supabase
    .from("leases")
    .select("id, unit_id, tenant_id, status, start_date")
    .in("unit_id", units.map((u) => u.id))
    .eq("status", "active");
  const leases = leasesData ?? [];

  const tenantIds = leases.map((l) => l.tenant_id);
  const { data: tenantsData } = await supabase
    .from("tenants")
    .select("id, first_name, last_name")
    .in("id", tenantIds.length > 0 ? tenantIds : ["00000000-0000-0000-0000-000000000000"]);
  const tenantById = new Map(
    (tenantsData ?? []).map((t) => [t.id, `${t.first_name} ${t.last_name}`.trim()])
  );

  // Most-recent active lease per unit
  const leaseByUnit = new Map<string, (typeof leases)[number]>();
  for (const l of leases) {
    const prior = leaseByUnit.get(l.unit_id);
    if (!prior || new Date(l.start_date).getTime() > new Date(prior.start_date).getTime()) {
      leaseByUnit.set(l.unit_id, l);
    }
  }

  const unitRows: UnitDrawerData[] = units.map((u) => {
    const lease = leaseByUnit.get(u.id);
    return {
      id: u.id,
      unit_number: u.unit_number,
      monthly_rent: u.monthly_rent != null ? Number(u.monthly_rent) : null,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms != null ? Number(u.bathrooms) : null,
      sqft: u.sqft,
      status: (u.status as UnitDrawerData["status"]) ?? "vacant",
      notes: u.notes,
      active_lease_id: lease?.id ?? null,
      tenant_name: lease ? tenantById.get(lease.tenant_id) ?? null : null,
    };
  });

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--fg)] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Units</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {property?.name ?? "Property"} · {units.length} units · click any card to edit
            </p>
          </div>
        </header>

        <UnitsGrid units={unitRows} />
      </div>
    </div>
  );
}
