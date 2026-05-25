import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function UnitsPage() {
  const supabase = await createServerSupabaseClient();

  // Fetch property
  const { data: properties } = await supabase
    .from("properties")
    .select("*")
    .limit(1);
  const property = properties?.[0];

  // Fetch units
  const { data: units = [] } = await supabase
    .from("units")
    .select("*")
    .eq("property_id", property?.id || "");

  // Fetch leases and tenants
  const { data: leases = [] } = await supabase
    .from("leases")
    .select("*")
    .eq("property_id", property?.id || "");

  const { data: tenants = [] } = await supabase
    .from("tenants")
    .select("*")
    .eq("property_id", property?.id || "");

  const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]));
  const leasesByUnit = Object.fromEntries(
    units.map((u) => [u.id, leases.filter((l) => l.unit_id === u.id)])
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Units</h1>
        <p className="mt-1 text-white/60">Manage your {units.length} rental units</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {units?.map((unit) => {
          const unitLeases = leasesByUnit[unit.id] || [];
          const lease = unitLeases[0];
          const tenant = lease ? tenantMap[lease.tenant_id] : null;
          const statusColorMap: Record<string, string> = {
            occupied: "border-green-500/30 bg-green-500/5 hover:bg-green-500/10",
            vacant: "border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10",
            maintenance: "border-red-500/30 bg-red-500/5 hover:bg-red-500/10",
          };
          const statusColor = statusColorMap[unit.status] || "border-gray-500/30 bg-gray-500/5 hover:bg-gray-500/10";

          return (
            <a
              key={unit.id}
              href={`/units/${unit.id}`}
              className={`rounded-xl border p-6 cursor-pointer transition ${statusColor}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Unit {unit.unit_number}</h3>
                  <p className="text-sm text-white/60 font-medium mt-1">
                    {unit.bedrooms} bed • {unit.bathrooms} bath
                  </p>
                </div>
                <span className="text-3xl">{unit.status === 'occupied' ? '✓' : unit.status === 'vacant' ? '⭕' : '🔧'}</span>
              </div>

              <div className="space-y-3 text-sm">
                <p className="text-white/80 font-medium">
                  <span className="text-white/60">Rent:</span> ${unit.monthly_rent}/month
                </p>
                {tenant && (
                  <p className="text-white/80 font-medium">
                    <span className="text-white/60">Tenant:</span> {tenant.first_name} {tenant.last_name}
                  </p>
                )}
                <div className="pt-2 border-t border-white/10">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/80 capitalize">
                    {unit.status}
                  </span>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
