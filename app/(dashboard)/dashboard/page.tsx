import { getCurrentUser } from "@/lib/auth-helpers";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getLatestAuditReport } from "@/app/actions/agents";
import { getLatestCadSync } from "@/app/actions/tax";
import { getLatestCapitalAnalysis } from "@/app/actions/capital";
import { getLatestYieldAnalysis } from "@/app/actions/yield";
import GodModeWidget from "@/components/GodModeWidget";
import MaintenanceNoteForm from "@/components/MaintenanceNoteForm";

export const dynamic = "force-dynamic";

type UnitRow = { id: string; status: string };
type WorkOrderRow = { id: string; status: string; priority: string };
type TxRow = { type: string; category: string; amount: number; date: string };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createServerSupabaseClient();

  const { data: properties } = await supabase.from("properties").select("*").limit(1);
  const property = properties?.[0];

  const [unitsRes, workOrdersRes, txRes, vendorsRes, unitsFullRes] = await Promise.all([
    supabase
      .from("units")
      .select("id, status")
      .eq("property_id", property?.id || ""),
    supabase
      .from("work_orders")
      .select("id, status, priority")
      .eq("property_id", property?.id || "")
      .in("status", ["open", "assigned", "in_progress"]),
    supabase
      .from("transactions")
      .select("type, category, amount, date")
      .eq("property_id", property?.id || "")
      .gte("date", `${new Date().getFullYear()}-01-01`),
    supabase
      .from("vendors")
      .select("id, name, trade")
      .order("name"),
    supabase
      .from("units")
      .select("id, unit_number")
      .eq("property_id", property?.id || "")
      .order("unit_number"),
  ]);

  const units: UnitRow[] = (unitsRes.data ?? []) as UnitRow[];
  const workOrders: WorkOrderRow[] = (workOrdersRes.data ?? []) as WorkOrderRow[];
  const transactions: TxRow[] = (txRes.data ?? []) as TxRow[];

  const occupiedUnits = units.filter((u) => u.status === "occupied").length;
  const totalUnits = units.length || 4;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const urgentWorkOrders = workOrders.filter((w) => w.priority === "urgent").length;

  // ── Financial roll-up for God Mode ────────────────────────────────────────
  const incomeYtd = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expensesYtd = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const noiYtd = incomeYtd - expensesYtd;

  const yearStart = new Date(`${new Date().getFullYear()}-01-01`).getTime();
  const elapsedMs = Math.max(1, Date.now() - yearStart);
  const yearFraction = Math.min(1, elapsedMs / (365 * 24 * 3600 * 1000));
  const annualizedNoi = noiYtd / Math.max(yearFraction, 1 / 12);

  const monthsElapsed = Math.max(1, Math.round(yearFraction * 12));
  const rentYtd = transactions
    .filter((t) => t.category === "rent")
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthlyRentRun = Math.round(rentYtd / monthsElapsed);

  const currentValue = property?.current_value ? Number(property.current_value) : null;
  const mortgageBalance = property?.mortgage_balance
    ? Number(property.mortgage_balance)
    : null;
  const equity =
    currentValue != null && mortgageBalance != null ? currentValue - mortgageBalance : null;
  const capRatePct =
    currentValue && currentValue > 0 ? (annualizedNoi / currentValue) * 100 : null;

  const rentDue = occupiedUnits * 1250;
  const rentCollected = Math.floor(rentDue * 0.8);

  const initialReport = await getLatestAuditReport().catch(() => null);
  const taxSync = await getLatestCadSync().catch(() => ({
    cad: null,
    delta: null,
    internal_value: currentValue,
    synced_at: null,
    protest_deadline: null,
  }));
  const capitalAnalysis = await getLatestCapitalAnalysis().catch(() => null);
  const yieldAnalysis = await getLatestYieldAnalysis().catch(() => null);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-white/60">
          1304 Rosario St, Laredo TX • Welcome, {user?.name}
        </p>
      </div>

      <GodModeWidget
        propertyName={property?.name || "Property"}
        equity={equity}
        capRatePct={capRatePct}
        noiYtd={noiYtd}
        monthlyRentRun={monthlyRentRun}
        initialReport={initialReport}
        tax={{
          initialCad: taxSync.cad,
          initialDelta: taxSync.delta,
          internalValue: taxSync.internal_value ?? currentValue,
          syncedAt: taxSync.synced_at,
          protestDeadline: taxSync.protest_deadline,
        }}
        capital={{ initial: capitalAnalysis }}
        yieldData={{ initial: yieldAnalysis }}
      />

      {/* KPI Grid */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
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
          value={equity != null ? `$${equity.toLocaleString()}` : "—"}
          subtitle={
            currentValue && mortgageBalance != null
              ? `LTV: ${Math.round((mortgageBalance / currentValue) * 100)}%`
              : "Set property value"
          }
          icon="🏦"
          color="purple"
        />
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-2xl">
        <h2 className="mb-5 text-lg font-semibold text-white">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <QuickActionButton href="/rent" label="Collect Rent" icon="💳" />
          <QuickActionButton href="/work-orders" label="Work Orders" icon="🔧" />
          <QuickActionButton href="/tenants" label="Tenants" icon="👥" />
          <QuickActionButton href="/finance" label="P&L" icon="📈" />
        </div>
      </div>

      {/* Maintenance note */}
      <div className="mt-8">
        <MaintenanceNoteForm
          units={unitsFullRes.data ?? []}
          vendors={vendorsRes.data ?? []}
        />
      </div>

      {/* Property Info */}
      {property && (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-2xl">
          <h2 className="mb-5 text-lg font-semibold text-white">Property Details</h2>
          <div className="grid grid-cols-2 gap-6 text-sm md:grid-cols-4">
            <Detail label="Address" value={property.name} />
            <Detail label="Units" value={`${property.units_count} total`} />
            <Detail
              label="Property Value"
              value={currentValue ? `$${currentValue.toLocaleString()}` : "—"}
            />
            <Detail
              label="Mortgage Balance"
              value={mortgageBalance != null ? `$${mortgageBalance.toLocaleString()}` : "—"}
            />
            <Detail
              label="Interest Rate"
              value={property.interest_rate ? `${property.interest_rate}%` : "—"}
            />
            <Detail
              label="Last Appraisal"
              value={
                property.last_appraisal_date
                  ? new Date(property.last_appraisal_date).toLocaleDateString()
                  : "—"
              }
            />
            <Detail label="Owner Entity" value={property.owner_entity || "—"} />
            <Detail
              label="Equity"
              value={equity != null ? `$${equity.toLocaleString()}` : "—"}
            />
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
    <div
      className={`rounded-xl border ${colorMap[color]} p-6 backdrop-blur-2xl transition hover:border-opacity-50`}
    >
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
      className="flex flex-col items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-5 text-center text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.08]"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs">{label}</span>
    </a>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-white/60">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}
