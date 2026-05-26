"use client";

import { useState, useTransition } from "react";
import { analyzeLossToLease } from "@/app/actions/yield";
import type { LossToLeaseAnalysis, UnitYieldRow } from "@/lib/ai/agents/argus-yield";

export type YieldOptimizationProps = {
  initial: LossToLeaseAnalysis | null;
};

const fmtUsd = (n: number | null | undefined, frac = 0) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: frac,
      });
const fmtPct = (n: number | null | undefined, frac = 1) =>
  n == null ? "—" : `${n.toFixed(frac)}%`;

const DELTA_BADGE: Record<UnitYieldRow["delta_label"], string> = {
  above: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  at: "border-zinc-300 dark:border-white/15 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-white/70",
  below: "border-rose-400/40 bg-rose-500/15 text-rose-200",
  vacant: "border-amber-400/40 bg-amber-500/15 text-amber-200",
};

export default function YieldOptimizationCard({ initial }: YieldOptimizationProps) {
  const [analysis, setAnalysis] = useState<LossToLeaseAnalysis | null>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const refresh = () => {
    setError(null);
    startTransition(async () => {
      const r = await analyzeLossToLease({ includeNarrative: true });
      if (r.success && r.analysis) {
        setAnalysis(r.analysis);
      } else {
        setError(r.error || "Yield analysis failed");
      }
    });
  };

  if (!analysis) {
    return (
      <div className="mt-4 rounded-xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/5 via-rose-500/5 to-fuchsia-500/5 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-300/80">
            ⌬ Yield Optimization
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={isPending}
            className="rounded-md border border-fuchsia-400/40 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50"
          >
            {isPending ? "Analyzing…" : "Run Analysis"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-white/50">
          Cross-reference active leases against the ZIP 78040 baseline ($950/mo
          2BR/1BA) to surface loss-to-lease leaks.
        </p>
        {error && (
          <p className="mt-2 rounded border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
            ⚠ {error}
          </p>
        )}
      </div>
    );
  }

  const visibleRows = showAll
    ? analysis.rows
    : analysis.flagged_units.length > 0
      ? analysis.flagged_units
      : analysis.rows;

  const leakSeverity =
    analysis.monthly_loss_to_lease > 0 || analysis.vacant_units > 0
      ? analysis.capture_rate_pct < 80
        ? "high"
        : analysis.capture_rate_pct < 95
          ? "medium"
          : "low"
      : "none";

  const leakTone =
    leakSeverity === "high"
      ? "border-rose-400/50 bg-rose-500/20 text-rose-100"
      : leakSeverity === "medium"
        ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
        : leakSeverity === "low"
          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
          : "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/5 via-rose-500/5 to-fuchsia-500/5 backdrop-blur-sm">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-300/80">
              ⌬ Yield Optimization
            </span>
            <span className="rounded bg-zinc-200/60 dark:bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:text-white/60">
              ZIP {analysis.zip}
            </span>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={isPending}
            className="rounded-md border border-fuchsia-400/40 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50"
          >
            {isPending ? "Re-analyzing…" : "Re-run"}
          </button>
        </div>

        {/* Loss-to-lease headline */}
        <div className={`mb-3 rounded-lg border px-3 py-2.5 backdrop-blur-sm ${leakTone}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
              Loss-to-lease leak
            </span>
            <span className="text-lg font-bold">
              {fmtUsd(analysis.monthly_loss_to_lease, 0)}/mo
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-[11px] opacity-90">
            <span>Annualized</span>
            <span className="font-semibold">{fmtUsd(analysis.annual_loss_to_lease, 0)}/yr</span>
          </div>
          {analysis.monthly_vacancy_loss > 0 && (
            <div className="mt-1 flex items-baseline justify-between text-[11px] opacity-90">
              <span>Vacancy drag ({analysis.vacant_units} vacant)</span>
              <span className="font-semibold">
                {fmtUsd(analysis.monthly_vacancy_loss, 0)}/mo
              </span>
            </div>
          )}
        </div>

        {/* Portfolio metric grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Micro
            label="Avg actual"
            value={fmtUsd(analysis.avg_actual_rent)}
            tone="neutral"
          />
          <Micro
            label="ZIP 78040 target"
            value={fmtUsd(analysis.avg_target_rent)}
            tone="indigo"
          />
          <Micro
            label="Capture rate"
            value={fmtPct(analysis.capture_rate_pct, 1)}
            tone={
              analysis.capture_rate_pct >= 95
                ? "good"
                : analysis.capture_rate_pct < 80
                  ? "danger"
                  : "neutral"
            }
          />
          <Micro
            label="Occupied"
            value={`${analysis.occupied_units}/${analysis.total_units}`}
            tone={
              analysis.vacant_units === 0
                ? "good"
                : analysis.vacant_units >= 2
                  ? "danger"
                  : "neutral"
            }
          />
        </div>

        {/* Per-unit rows (flagged-only by default) */}
        {analysis.rows.length > 0 && (
          <div className="mt-3 rounded-lg border border-zinc-200 dark:border-white/10 bg-black/20">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/50">
              <span>{showAll ? "All units" : "Action-required units"}</span>
              {analysis.flagged_units.length > 0 && analysis.rows.length > visibleRows.length && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="rounded bg-zinc-100 dark:bg-white/5 px-2 py-0.5 text-[10px] font-normal text-zinc-600 dark:text-white/60 hover:bg-white/10"
                >
                  Show all {analysis.rows.length}
                </button>
              )}
              {showAll && analysis.flagged_units.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className="rounded bg-zinc-100 dark:bg-white/5 px-2 py-0.5 text-[10px] font-normal text-zinc-600 dark:text-white/60 hover:bg-white/10"
                >
                  Flagged only
                </button>
              )}
            </div>
            <ul className="divide-y divide-zinc-200 dark:divide-white/5">
              {visibleRows.length === 0 ? (
                <li className="px-3 py-3 text-center text-[11px] text-emerald-200/80">
                  ✓ All units at or above target — no action required.
                </li>
              ) : (
                visibleRows.map((r) => (
                  <li
                    key={r.unit_id}
                    className="grid grid-cols-12 items-center gap-2 px-3 py-2 text-[11px]"
                  >
                    <span className="col-span-2 font-semibold text-zinc-900 dark:text-white">
                      #{r.unit_number}
                      <span className="ml-1 text-[10px] text-zinc-500 dark:text-white/40">
                        {r.bedrooms ?? "?"}BR/{r.bathrooms ?? "?"}BA
                      </span>
                    </span>
                    <span className="col-span-3 text-zinc-600 dark:text-white/70">
                      <span className="text-zinc-500 dark:text-white/40">cur</span>{" "}
                      {fmtUsd(r.current_rent)}
                    </span>
                    <span className="col-span-3 text-zinc-600 dark:text-white/70">
                      <span className="text-zinc-500 dark:text-white/40">target</span>{" "}
                      <span className="font-semibold text-indigo-200">{fmtUsd(r.target_rent)}</span>
                    </span>
                    <span
                      className={`col-span-2 rounded border px-1.5 py-0.5 text-center font-semibold uppercase ${DELTA_BADGE[r.delta_label]}`}
                    >
                      {r.delta_label === "vacant"
                        ? "vacant"
                        : r.delta_label === "above"
                          ? "above"
                          : r.delta_label === "at"
                            ? "at"
                            : `−${(r.loss_pct ?? 0).toFixed(0)}%`}
                    </span>
                    <span className="col-span-2 text-right text-zinc-600 dark:text-white/60">
                      {r.renewal_window_days != null && r.renewal_window_days >= 0
                        ? `renew ${r.renewal_window_days}d`
                        : r.renewal_window_days != null && r.renewal_window_days < 0
                          ? `MTM ${Math.abs(r.renewal_window_days)}d`
                          : "—"}
                    </span>
                    {r.flags.length > 0 && (
                      <ul className="col-span-12 mt-1 space-y-0.5 pl-4 text-[10px] text-zinc-500 dark:text-white/55">
                        {r.flags.map((f, i) => (
                          <li key={i}>· {f}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {/* AI narrative panel */}
        {analysis.narrative && (
          <div className="mt-3 rounded-lg border border-fuchsia-400/20 bg-black/30 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-300/70">
              Argus-Yield narrative
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-800 dark:text-white/85">{analysis.narrative}</p>
            {analysis.narrative_model && (
              <p className="mt-1 text-[10px] text-zinc-500 dark:text-white/40">
                {analysis.narrative_model} · ${analysis.narrative_cost_usd.toFixed(4)}
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-3 rounded border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
            ⚠ {error}
          </p>
        )}
      </div>
    </div>
  );
}

function Micro({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "danger" | "neutral" | "indigo";
}) {
  const cls =
    tone === "good"
      ? "text-emerald-200"
      : tone === "danger"
        ? "text-rose-200"
        : tone === "indigo"
          ? "text-indigo-200"
          : "text-fuchsia-100";
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-white/10 bg-black/20 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/45">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-bold ${cls}`}>{value}</p>
    </div>
  );
}
