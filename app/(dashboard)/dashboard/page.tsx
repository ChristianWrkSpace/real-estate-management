import { getCurrentUser } from "@/lib/auth-helpers";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getLatestAuditReport } from "@/app/actions/agents";
import { getLatestCadSync } from "@/app/actions/tax";
import { getLatestCapitalAnalysis } from "@/app/actions/capital";
import { getLatestYieldAnalysis } from "@/app/actions/yield";
import { getPerUnitPnl, getMortgageBreakdown } from "@/app/actions/ledger";

import GodModeTabs from "@/components/GodModeTabs";
import MaintenanceNoteForm from "@/components/MaintenanceNoteForm";
import UnitLedgerGrid from "@/components/UnitLedgerGrid";
import MortgageEquityTracker from "@/components/MortgageEquityTracker";

export const dynamic = "force-dynamic";

type UnitRow = { id: string; status: string };
type WorkOrderRow = { id: string; status: string; priority: string };
type TxRow = { type: string; category: string; amount: number; date: string };

type Accent = "emerald" | "rose" | "amber" | "indigo" | "blue";

const QUICK_ACTIONS: { href: string; label: string; icon: string; accent: Accent }[] = [
  { href: "/rent", label: "Collect Rent", icon: "💳", accent: "emerald" },
  { href: "/work-orders", label: "Work Orders", icon: "🔧", accent: "amber" },
  { href: "/tenants", label: "Tenants", icon: "👥", accent: "blue" },
  { href: "/finance", label: "Full P&L", icon: "📈", accent: "indigo" },
];

const ACCENT_TEXT: Record<Accent, string> = {
  emerald: "text-emerald-400",
  rose: "text-rose-400",
  amber: "text-amber-400",
  indigo: "text-indigo-400",
  blue: "text-blue-400",
};

const fmtUsd = (n: number | null, frac = 0) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: frac,
      });

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createServerSupabaseClient();

  const { data: properties } = await supabase.from("properties").select("*").limit(1);
  const property = properties?.[0];

  const [unitsRes, workOrdersRes, txRes, vendorsRes, unitsFullRes] = await Promise.all([
    supabase.from("units").select("id, status").eq("property_id", property?.id || ""),
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
    supabase.from("vendors").select("id, name, trade").order("name"),
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

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const rentMtd = transactions
    .filter((t) => t.type === "income" && t.category === "rent" && t.date >= firstOfMonth)
    .reduce((s, t) => s + Number(t.amount), 0);

  const currentValue = property?.current_value ? Number(property.current_value) : null;
  const mortgageBalance = property?.mortgage_balance ? Number(property.mortgage_balance) : null;
  const equity =
    currentValue != null && mortgageBalance != null ? currentValue - mortgageBalance : null;

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
  const [unitPnl, mortgageBreakdown] = await Promise.all([
    getPerUnitPnl().catch(() => null),
    getMortgageBreakdown().catch(() => null),
  ]);

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--fg)] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {property?.name ?? "Property"} · Welcome, {user?.name}
            </p>
          </div>
          {initialReport?.asOf && (
            <span className="rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 font-mono text-xs uppercase tracking-wider text-zinc-500">
              audit · {initialReport.asOf}
            </span>
          )}
        </header>

        {/* 4-Card KPI Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Occupancy"
            metric={`${occupiedUnits}/${totalUnits}`}
            description={`${occupancyRate}% leased`}
            accent="emerald"
          />
          <StatCard
            label="Rent MTD"
            metric={fmtUsd(rentMtd)}
            description={firstOfMonth.slice(0, 7)}
            accent="emerald"
          />
          <StatCard
            label="Open Tickets"
            metric={String(workOrders.length)}
            description={urgentWorkOrders > 0 ? `${urgentWorkOrders} urgent` : "none urgent"}
            accent={urgentWorkOrders > 0 ? "rose" : "amber"}
          />
          <StatCard
            label="Live Equity"
            metric={fmtUsd(equity)}
            description={
              currentValue && mortgageBalance != null
                ? `LTV ${((mortgageBalance / currentValue) * 100).toFixed(1)}%`
                : "Set values"
            }
            accent="emerald"
          />
        </div>

        {/* Intelligence Layer */}
        <section className="space-y-3">
          <SectionLabel>Intelligence Layer</SectionLabel>
          <GodModeTabs
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
        </section>

        {/* Operations Row: Maintenance (2 cols) + Quick Actions (1 col) */}
        <section className="space-y-3">
          <SectionLabel>Operations</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <MaintenanceNoteForm
                units={unitsFullRes.data ?? []}
                vendors={vendorsRes.data ?? []}
              />
            </div>
            <QuickActionsPanel />
          </div>
        </section>

        {/* Mortgage tracker */}
        <section className="space-y-3">
          <SectionLabel>Mortgage &amp; Equity</SectionLabel>
          <MortgageEquityTracker initial={mortgageBreakdown} />
        </section>

        {/* Per-Unit P&L */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <SectionLabel>Per-Unit P&amp;L Matrix</SectionLabel>
            <a
              href="/finance"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Full ledger →
            </a>
          </div>
          <UnitLedgerGrid data={unitPnl} />
        </section>

        {/* Property snapshot */}
        {property && (
          <section className="space-y-3">
            <SectionLabel>Property Snapshot</SectionLabel>
            <div className="bg-zinc-900/80 border border-zinc-800 p-6 rounded-xl shadow-xl">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <Detail label="Address" value={property.name} />
                <Detail label="Units" value={`${property.units_count} total`} />
                <Detail label="Value" value={fmtUsd(currentValue)} mono />
                <Detail label="Mortgage" value={fmtUsd(mortgageBalance)} mono />
                <Detail
                  label="Interest"
                  value={property.interest_rate ? `${property.interest_rate}%` : "—"}
                  mono
                />
                <Detail
                  label="Last appraisal"
                  value={
                    property.last_appraisal_date
                      ? new Date(property.last_appraisal_date).toLocaleDateString()
                      : "—"
                  }
                />
                <Detail label="Owner" value={property.owner_entity || "—"} />
                <Detail label="Equity" value={fmtUsd(equity)} mono accent />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
      {children}
    </h2>
  );
}

function StatCard({
  label,
  metric,
  description,
  accent,
}: {
  label: string;
  metric: string;
  description: string;
  accent: Accent;
}) {
  return (
    <div className="bg-zinc-900/80 border border-zinc-800 p-6 rounded-xl shadow-xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <p
        className={`mt-3 font-mono text-2xl font-semibold tracking-tight ${ACCENT_TEXT[accent]}`}
      >
        {metric}
      </p>
      <p className="mt-1.5 text-xs text-zinc-400">{description}</p>
    </div>
  );
}

function QuickActionsPanel() {
  return (
    <div className="bg-zinc-900/80 border border-zinc-800 p-6 rounded-xl shadow-xl">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
        ⚡ Quick Actions
      </p>
      <p className="mt-1 text-xs text-zinc-500">Jump to any module</p>
      <div className="mt-4 space-y-2.5">
        {QUICK_ACTIONS.map((q) => (
          <a
            key={q.href}
            href={q.href}
            className="group flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 transition hover:border-zinc-700 hover:bg-zinc-900"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">{q.icon}</span>
              <span className="text-sm font-semibold tracking-tight text-zinc-100">
                {q.label}
              </span>
            </div>
            <span
              className={`text-base ${ACCENT_TEXT[q.accent]} opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100`}
            >
              →
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  mono = false,
  accent = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-sm font-semibold tracking-tight ${mono ? "font-mono" : ""} ${
          accent ? "text-emerald-400" : "text-zinc-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
