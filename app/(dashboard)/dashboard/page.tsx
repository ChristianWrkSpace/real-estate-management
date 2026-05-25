import { getCurrentUser } from "@/lib/auth-helpers";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function DashboardPage() {
  const user = await getCurrentUser();
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

  // Fetch work orders
  const { data: workOrders = [] } = await supabase
    .from("work_orders")
    .select("*")
    .eq("property_id", property?.id || "")
    .in("status", ["open", "assigned", "in_progress"]);

  const occupiedUnits = units.filter((u) => u.status === "occupied").length;
  const totalUnits = units.length || 4;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  // Calculate rent due based on occupied units
  const rentDue = occupiedUnits * 1250;
  const rentCollected = Math.floor(rentDue * 0.8);

  const urgentWorkOrders = (workOrders as any[]).filter(
    (w) => w.priority === "urgent"
  ).length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-white/60">
          1304 Rosario St, Laredo TX • Welcome, {user?.name}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <KpiCard
          title="Occupancy"
          value={`${occupiedUnits}/${totalUnits}`}
          subtitle={`${occupancyRate}%`}
          icon="🏠"
          color="blue"
        />
        <KpiCard
          title="Rent Collected (MTD)"
          value={`$${rentCollected.toLocaleString()}`}
          subtitle={`of $${rentDue.toLocaleString()}`}
          icon="💰"
          color="green"
        />
        <KpiCard
          title="Open Work Orders"
          value={workOrders.length.toString()}
          subtitle={
            urgentWorkOrders > 0 ? `${urgentWorkOrders} urgent` : "No urgent"
          }
          icon="🔧"
          color={urgentWorkOrders > 0 ? "red" : "yellow"}
        />
        <KpiCard
          title="Equity"
          value={`$${((property?.current_value ?? 0) - (property?.mortgage_balance ?? 0)).toLocaleString()}`}
          subtitle={`LTV: ${property ? Math.round(((property.mortgage_balance ?? 0) / (property.current_value ?? 1)) * 100) : 0}%`}
          icon="🏦"
          color="purple"
        />
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-2xl">
        <h2 className="mb-5 text-lg font-semibold text-white">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <QuickActionButton href="/rent" label="Collect Rent" icon="💳" />
          <QuickActionButton href="/work-orders/new" label="New Work Order" icon="➕" />
          <QuickActionButton href="/tenants" label="Manage Tenants" icon="👥" />
          <QuickActionButton href="/approvals" label="Approvals" icon="✅" />
        </div>
      </div>

      {/* Property Info */}
      {property && (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-2xl">
          <h2 className="mb-5 text-lg font-semibold text-white">Property Details</h2>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4 text-sm">
            <div>
              <p className="text-white/60 font-medium">Address</p>
              <p className="font-semibold text-white mt-1">{property.name}</p>
            </div>
            <div>
              <p className="text-white/60 font-medium">Units</p>
              <p className="font-semibold text-white mt-1">{property.units_count} total</p>
            </div>
            <div>
              <p className="text-white/60 font-medium">Property Value</p>
              <p className="font-semibold text-white mt-1">${property.current_value?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-white/60 font-medium">Mortgage Balance</p>
              <p className="font-semibold text-white mt-1">
                ${property.mortgage_balance?.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color = "blue",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  color?: "blue" | "green" | "red" | "yellow" | "purple";
}) {
  const colorMap = {
    blue: "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10",
    green: "border-green-500/30 bg-green-500/5 hover:bg-green-500/10",
    red: "border-red-500/30 bg-red-500/5 hover:bg-red-500/10",
    yellow: "border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10",
    purple: "border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10",
  };

  return (
    <div className={`rounded-xl border ${colorMap[color]} p-6 backdrop-blur-2xl transition hover:border-opacity-50`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/70">{title}</p>
          <p className="mt-3 text-3xl font-bold text-white">{value}</p>
          <p className="mt-2 text-xs text-white/50">{subtitle}</p>
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  );
}

function QuickActionButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-5 text-center text-sm font-medium text-white/80 transition hover:bg-white/[0.08] hover:border-white/20"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs">{label}</span>
    </a>
  );
}
