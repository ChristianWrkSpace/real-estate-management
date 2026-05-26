"use client";

import type { PerUnitPnl, UnitPnlRow } from "@/app/actions/ledger";

const fmtUsd = (n: number | null | undefined, frac = 0) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: frac,
      });

const STATUS_BADGE: Record<UnitPnlRow["rent_status"], { label: string; cls: string }> = {
  paid:    { label: "Paid",    cls: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" },
  partial: { label: "Partial", cls: "border-amber-400/40 bg-amber-500/15 text-amber-200" },
  due:     { label: "Due",     cls: "border-rose-400/40 bg-rose-500/15 text-rose-200" },
  vacant:  { label: "Vacant",  cls: "border-white/15 bg-white/5 text-white/60" },
};

export default function UnitLedgerGrid({ data }: { data: PerUnitPnl | null }) {
  if (!data || data.units.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/40 backdrop-blur-sm">
        No units configured yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.units.map((u) => (
          <UnitColumn key={u.unit_id} u={u} />
        ))}
      </div>

      {data.totals.common_area_expenses_ytd > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs text-white/60 backdrop-blur-sm">
          <span className="font-semibold text-white/80">Common-area expenses YTD:</span>{" "}
          {fmtUsd(data.totals.common_area_expenses_ytd, 2)} (mortgage, insurance, property tax,
          landscaping — not attributed to a single unit)
        </div>
      )}
    </div>
  );
}

function UnitColumn({ u }: { u: UnitPnlRow }) {
  const badge = STATUS_BADGE[u.rent_status];
  const cashFlowPositive = u.net_cash_flow_ytd >= 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-white/[0.04] backdrop-blur-xl transition hover:border-white/20">
      {/* Header */}
      <div className="border-b border-white/5 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Unit {u.unit_number}</h3>
            <p className="text-[11px] text-white/50">
              {u.bedrooms ?? "?"}BR · {u.bathrooms ?? "?"}BA
            </p>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>
        {u.tenant_name ? (
          <p className="mt-2 truncate text-xs text-white/70" title={u.tenant_name}>
            👤 {u.tenant_name}
          </p>
        ) : (
          <p className="mt-2 text-xs italic text-white/40">No active tenant</p>
        )}
      </div>

      {/* Metrics */}
      <div className="space-y-2.5 p-4">
        <Stat
          label="Scheduled rent"
          value={fmtUsd(u.scheduled_rent ?? u.monthly_rent)}
          suffix={u.scheduled_rent ? "/mo" : "/mo (posted)"}
        />
        <Stat
          label="Income YTD"
          value={fmtUsd(u.income_ytd, 2)}
          accent="emerald"
        />
        <Stat
          label="Expenses YTD"
          value={fmtUsd(u.expenses_ytd, 2)}
          accent="rose"
        />
        <div className="my-2 border-t border-white/5" />
        <Stat
          label="Net cash flow YTD"
          value={`${cashFlowPositive ? "+" : ""}${fmtUsd(u.net_cash_flow_ytd, 2)}`}
          accent={cashFlowPositive ? "emerald" : "rose"}
          big
        />
        <Stat
          label="Net unit yield"
          value={
            u.net_yield_pct == null
              ? "—"
              : `${u.net_yield_pct >= 0 ? "+" : ""}${u.net_yield_pct.toFixed(1)}%`
          }
          accent={
            u.net_yield_pct == null
              ? "neutral"
              : u.net_yield_pct >= 0
                ? "emerald"
                : "rose"
          }
          suffix={u.net_yield_pct == null ? undefined : "annualized"}
        />

        {u.open_work_orders > 0 && (
          <p className="mt-3 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
            🔧 {u.open_work_orders} open work order{u.open_work_orders === 1 ? "" : "s"}
          </p>
        )}

        <div className="mt-3 space-y-0.5 text-[10px] text-white/40">
          {u.last_rent_payment_at && (
            <p>Last income: {u.last_rent_payment_at}</p>
          )}
          {u.last_expense_at && <p>Last expense: {u.last_expense_at}</p>}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  accent = "neutral",
  big = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: "emerald" | "rose" | "neutral";
  big?: boolean;
}) {
  const accentCls =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "rose"
        ? "text-rose-300"
        : "text-white";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-white/55">
        {label}
      </span>
      <span className={`${big ? "text-lg font-bold" : "text-sm font-semibold"} ${accentCls}`}>
        {value}
        {suffix && (
          <span className="ml-0.5 text-[10px] font-normal text-white/45">{suffix}</span>
        )}
      </span>
    </div>
  );
}
