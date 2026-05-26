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

const QUICK_ACTIONS = [
  { href: "/rent", label: "Collect Rent", icon: "💳", accent: "emerald" as const },
  { href: "/work-orders", label: "Work Orders", icon: "🔧", accent: "amber" as const },
  { href: "/tenants", label: "Tenants", icon: "👥", accent: "blue" as const },
  { href: "/finance", label: "Full P&L", icon: "📈", accent: "indigo" as const },
];

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

  // Rent MTD (this month)
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const rentMtd = transactions
    .filter((t) => t.type === "income" && t.category === "rent" && t.date >= firstOfMonth)
    .reduce((s, t) => s + Number(t.amount), 0);

  // Equity from property
  const currentValue = property?.current_value ? Number(property.current_value) : null;
  const mortgageBalance = property?.mortgage_balance ? Number(property.mortgage_balance) : null;
  const equity =
    currentValue != null && mortgageBalance != null ? currentValue - mortgageBalance : null;

  // God Mode data
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
    <div className="min-h-full space-y-8 bg-[#09090b] p-8">
      {/* Title */}
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {property?.name ?? "Property"} · Welcome, {user?.name}
          </p>
        </div>
        {initialReport?.asOf && (
          <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            audit · {initialReport.asOf}
          </span>
        )}
      </header>

      {/* KPI strip — 4-up */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Occupancy"
          value={`${occupiedUnits}/${totalUnits}`}
          accent="emerald"
          sub={`${occupancyRate}%`}
        />
        <KpiCard
          label="Rent MTD"
          value={fmtUsd(rentMtd)}
          accent="emerald"
          sub={firstOfMonth.slice(0, 7)}
        />
        <KpiCard
          label="Open Tickets"
          value={String(workOrders.length)}
          accent={urgentWorkOrders > 0 ? "rose" : "amber"}
          sub={urgentWorkOrders > 0 ? `${urgentWorkOrders} urgent` : "none urgent"}
        />
        <KpiCard
          label="Live Equity"
          value={fmtUsd(equity)}
          accent="emerald"
          sub={
            currentValue && mortgageBalance != null
              ? `LTV ${((mortgageBalance / currentValue) * 100).toFixed(1)}%`
              : "Set values"
          }
        />
      </section>

      {/* God Mode tabbed panel */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
          Intelligence Layer
        </h2>
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

      {/* Side-by-side: Maintenance + Quick Actions */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MaintenanceNoteForm
          units={unitsFullRes.data ?? []}
          vendors={vendorsRes.data ?? []}
        />
        <QuickActionsPanel />
      </section>

      {/* Mortgage tracker */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
          Mortgage &amp; Equity (live amortization)
        </h2>
        <MortgageEquityTracker initial={mortgageBreakdown} />
      </section>

      {/* Per-unit P&L matrix */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
            Per-Unit P&amp;L Matrix
          </h2>
          <a
            href="/finance"
            className="text-[11px] text-zinc-500 transition hover:text-zinc-300"
          >
            Full ledger →
          </a>
        </div>
        <UnitLedgerGrid data={unitPnl} />
      </section>

      {/* Property details — single standard card */}
      {property && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
            Property Snapshot
          </h2>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.15]">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <Detail label="Address" value={property.name} />
              <Detail label="Units" value={`${property.units_count} total`} />
              <Detail label="Value" mono value={fmtUsd(currentValue)} />
              <Detail label="Mortgage" mono value={fmtUsd(mortgageBalance)} />
              <Detail
                label="Interest"
                mono
                value={property.interest_rate ? `${property.interest_rate}%` : "—"}
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
              <Detail label="Equity" mono accent value={fmtUsd(equity)} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const ACCENT_NUMBER: Record<"emerald" | "rose" | "amber" | "indigo" | "blue", string> = {
  emerald: "text-emerald-400",
  rose: "text-rose-400",
  amber: "text-amber-400",
  indigo: "text-indigo-400",
  blue: "text-blue-400",
};
const ACCENT_GLOW: Record<"emerald" | "rose" | "amber" | "indigo" | "blue", string> = {
  emerald: "hover:shadow-[0_0_28px_rgba(16,185,129,0.10)]",
  rose: "hover:shadow-[0_0_28px_rgba(244,63,94,0.12)]",
  amber: "hover:shadow-[0_0_28px_rgba(245,158,11,0.12)]",
  indigo: "hover:shadow-[0_0_28px_rgba(99,102,241,0.10)]",
  blue: "hover:shadow-[0_0_28px_rgba(59,130,246,0.10)]",
};

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "emerald" | "rose" | "amber" | "indigo" | "blue";
}) {
  return (
    <div
      className={`rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.15] ${ACCENT_GLOW[accent]}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-3 font-mono text-3xl font-bold tracking-tight ${ACCENT_NUMBER[accent]}`}>
        {value}
      </p>
      <p className="mt-1.5 text-xs text-zinc-400">{sub}</p>
    </div>
  );
}

function QuickActionsPanel() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.15]">
      <div className="mb-4 flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
          ⚡ Quick Actions
        </span>
        <span className="text-[10px] text-zinc-500">jump to any module</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map((q) => (
          <a
            key={q.href}
            href={q.href}
            className={`group flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3.5 transition-all duration-300 hover:border-white/[0.18] hover:bg-white/[0.06] ${ACCENT_GLOW[q.accent]}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{q.icon}</span>
              <span className="text-sm font-semibold tracking-tight text-zinc-200 transition group-hover:text-zinc-100">
                {q.label}
              </span>
            </div>
            <span className={`text-base font-bold ${ACCENT_NUMBER[q.accent]} opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100`}>
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
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
      <p
        className={`mt-1 ${mono ? "font-mono" : ""} text-sm font-semibold tracking-tight ${
          accent ? "text-emerald-400" : "text-zinc-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
