"use client";

import { useState, useTransition } from "react";
import { runFinancialAudit, type FinancialAuditReport } from "@/app/actions/agents";
import TaxIntelligenceCard, { type TaxIntelligenceProps } from "@/components/TaxIntelligenceCard";
import CapitalStrategyCard, { type CapitalStrategyProps } from "@/components/CapitalStrategyCard";
import YieldOptimizationCard, { type YieldOptimizationProps } from "@/components/YieldOptimizationCard";

type Props = {
  propertyName: string;
  equity: number | null;
  capRatePct: number | null;
  noiYtd: number;
  monthlyRentRun: number;
  initialReport: FinancialAuditReport | null;
  tax: TaxIntelligenceProps;
  capital: CapitalStrategyProps;
  yieldData: YieldOptimizationProps;
};

const fmtUsd = (n: number | null | undefined, frac = 0) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: frac,
      });

const fmtPct = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toFixed(2)}%`;

export default function GodModeWidget({
  propertyName,
  equity,
  capRatePct,
  noiYtd,
  monthlyRentRun,
  initialReport,
  tax,
  capital,
  yieldData,
}: Props) {
  const [report, setReport] = useState<FinancialAuditReport | null>(initialReport);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const runAudit = () => {
    setError(null);
    startTransition(async () => {
      const r = await runFinancialAudit();
      if (r.success && r.report) {
        setReport(r.report);
        setOpen(true);
      } else {
        setError(r.error || "Audit failed");
      }
    });
  };

  const stale =
    !report ||
    (report.asOf &&
      (Date.now() - new Date(report.asOf).getTime()) / (1000 * 60 * 60 * 24) > 7);

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 via-indigo-950/40 to-slate-900/60 p-1 backdrop-blur-2xl shadow-[0_0_60px_rgba(99,102,241,0.08)]">
      <div className="rounded-2xl bg-slate-950/40 p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300/80">
              ◢ God Mode
            </span>
            <span className="text-xs text-zinc-500 dark:text-white/40">· {propertyName}</span>
          </div>
          <button
            type="button"
            onClick={runAudit}
            disabled={isPending}
            className="rounded-lg border border-indigo-400/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/20 disabled:opacity-50"
          >
            {isPending ? "Auditing…" : stale ? "Run Argus Audit" : "Re-run Audit"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metric label="Live Equity" value={fmtUsd(equity)} accent="emerald" />
          <Metric label="Cap Rate" value={fmtPct(capRatePct)} accent="indigo" />
          <Metric label="NOI YTD" value={fmtUsd(noiYtd)} accent="blue" />
          <Metric
            label="Run-rate Rent"
            value={`${fmtUsd(monthlyRentRun)}/mo`}
            accent="purple"
          />
        </div>

        <TaxIntelligenceCard {...tax} />

        <CapitalStrategyCard {...capital} />

        <YieldOptimizationCard {...yieldData} />

        <div className="mt-5 border-t border-zinc-200 dark:border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left text-sm font-semibold text-zinc-700 dark:text-white/80 transition hover:text-white"
          >
            <span className="flex items-center gap-2">
              <span className="text-indigo-300">⚡ AI Financial Insights</span>
              {report?.model && (
                <span className="rounded-full bg-zinc-200/60 dark:bg-white/10 px-2 py-0.5 text-[10px] font-normal text-zinc-500 dark:text-white/50">
                  {report.model}
                </span>
              )}
              {report?.asOf && (
                <span className="text-[10px] text-zinc-500 dark:text-white/40">
                  as of {report.asOf}
                </span>
              )}
            </span>
            <span className="text-zinc-500 dark:text-white/40">{open ? "▾" : "▸"}</span>
          </button>

          {open && (
            <div className="mt-4 space-y-3">
              {report ? (
                <>
                  <p className="text-sm leading-relaxed text-zinc-800 dark:text-white/85">
                    {report.narrative}
                  </p>

                  {report.flags?.length > 0 && (
                    <ul className="space-y-1">
                      {report.flags.map((f, i) => (
                        <li
                          key={i}
                          className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200"
                        >
                          ⚠ {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500 dark:text-white/50 md:grid-cols-4">
                    <Pill label="Income YTD" value={fmtUsd(report.gross_income_ytd)} />
                    <Pill label="Expenses YTD" value={fmtUsd(report.total_expenses_ytd)} />
                    <Pill label="Cash-on-Cash" value={fmtPct(report.cash_on_cash_pct)} />
                    <Pill
                      label="Cost"
                      value={`$${report.cost_usd.toFixed(4)}`}
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-white/50">
                  No audit yet. Click <span className="text-indigo-300">Run Argus Audit</span>{" "}
                  to generate one.
                </p>
              )}

              {error && <p className="text-xs text-red-300">⚠ {error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "emerald" | "indigo" | "blue" | "purple";
}) {
  const accentMap = {
    emerald: "text-emerald-300",
    indigo: "text-indigo-300",
    blue: "text-blue-300",
    purple: "text-purple-300",
  };
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.03] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/50">
        {label}
      </p>
      <p className={`mt-1.5 text-2xl font-bold ${accentMap[accent]}`}>{value}</p>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-zinc-100 dark:bg-white/5 px-2 py-1.5">
      <p className="text-zinc-500 dark:text-white/40">{label}</p>
      <p className="font-semibold text-zinc-700 dark:text-white/80">{value}</p>
    </div>
  );
}
