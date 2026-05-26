"use client";

import { useState, useTransition } from "react";
import { analyzeCapitalStructure } from "@/app/actions/capital";
import type { CapitalAnalysis, CapitalRecommendation } from "@/lib/ai/agents/ledger-capital";

export type CapitalStrategyProps = {
  initial: CapitalAnalysis | null;
};

const fmtUsd = (n: number | null | undefined, frac = 0) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: frac,
      });
const fmtPct = (n: number | null | undefined, frac = 2) =>
  n == null ? "—" : `${n.toFixed(frac)}%`;

const REC_BADGE: Record<CapitalRecommendation, { label: string; cls: string; emoji: string }> = {
  refi_rate: {
    label: "Rate refi",
    cls: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
    emoji: "📉",
  },
  cash_out_refi: {
    label: "Cash-out refi",
    cls: "border-indigo-400/40 bg-indigo-500/15 text-indigo-200",
    emoji: "💎",
  },
  hold: {
    label: "Hold",
    cls: "border-zinc-300 dark:border-white/15 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-white/70",
    emoji: "⏸",
  },
  deleverage: {
    label: "Deleverage",
    cls: "border-rose-400/40 bg-rose-500/15 text-rose-200",
    emoji: "⚠",
  },
  insufficient_data: {
    label: "Set values",
    cls: "border-amber-400/40 bg-amber-500/15 text-amber-200",
    emoji: "✦",
  },
};

export default function CapitalStrategyCard({ initial }: CapitalStrategyProps) {
  const [analysis, setAnalysis] = useState<CapitalAnalysis | null>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const refresh = (withNarrative: boolean) => {
    setError(null);
    startTransition(async () => {
      const r = await analyzeCapitalStructure({ includeNarrative: withNarrative });
      if (r.success && r.analysis) {
        setAnalysis(r.analysis);
      } else {
        setError(r.error || "Capital analysis failed");
      }
    });
  };

  if (!analysis) {
    return (
      <div className="mt-4 rounded-xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-indigo-500/5 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300/80">
            ◢ Capital Strategy
          </span>
          <button
            type="button"
            onClick={() => refresh(true)}
            disabled={isPending}
            className="rounded-md border border-indigo-400/40 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
          >
            {isPending ? "Analyzing…" : "Run Analysis"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-white/50">
          Compute live LTV, equity, and refi math for the property.
        </p>
        {error && (
          <p className="mt-2 rounded border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
            ⚠ {error}
          </p>
        )}
      </div>
    );
  }

  const rec = REC_BADGE[analysis.recommendation];
  const equityHigh = (analysis.ltv_pct ?? 100) < 65;
  const overpaying = (analysis.rate_delta_pct ?? 0) >= 1.0;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-indigo-500/5 backdrop-blur-sm">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300/80">
              ◢ Capital Strategy
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${rec.cls}`}
            >
              {rec.emoji} {rec.label}
            </span>
          </div>
          <button
            type="button"
            onClick={() => refresh(true)}
            disabled={isPending}
            className="rounded-md border border-indigo-400/40 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
          >
            {isPending ? "Analyzing…" : "Re-run"}
          </button>
        </div>

        <p className="mb-3 text-sm font-semibold text-zinc-800 dark:text-white/90">{analysis.headline}</p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Micro
            label="LTV"
            value={fmtPct(analysis.ltv_pct, 1)}
            tone={
              (analysis.ltv_pct ?? 0) > 80
                ? "danger"
                : (analysis.ltv_pct ?? 100) < 65
                  ? "good"
                  : "neutral"
            }
          />
          <Micro
            label="Equity"
            value={fmtUsd(analysis.equity)}
            tone={equityHigh ? "good" : "neutral"}
          />
          <Micro
            label="Cash-on-Cash"
            value={fmtPct(analysis.cash_on_cash_pct, 2)}
            tone={
              (analysis.cash_on_cash_pct ?? 0) >= 8
                ? "good"
                : (analysis.cash_on_cash_pct ?? 0) < 4
                  ? "danger"
                  : "neutral"
            }
          />
          <Micro
            label="Cap Rate"
            value={fmtPct(analysis.yield_on_value_pct, 2)}
            tone="neutral"
          />
        </div>

        {/* Refi math row */}
        {(analysis.monthly_savings_at_market != null || analysis.cash_out_amount_at_75ltv != null) && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {analysis.rate_delta_pct != null && (
              <RefiBlock
                label="Rate delta vs market"
                primary={`${analysis.rate_delta_pct >= 0 ? "+" : ""}${analysis.rate_delta_pct.toFixed(2)}%`}
                secondary={`market ${fmtPct(analysis.market_refi_rate_pct, 2)}`}
                accent={overpaying ? "warning" : "neutral"}
              />
            )}
            {analysis.monthly_savings_at_market != null && (
              <RefiBlock
                label="Monthly savings @ market"
                primary={fmtUsd(analysis.monthly_savings_at_market, 0)}
                secondary={
                  analysis.annual_savings_at_market != null
                    ? `${fmtUsd(analysis.annual_savings_at_market, 0)}/yr`
                    : "—"
                }
                accent={
                  (analysis.monthly_savings_at_market ?? 0) > 0 ? "good" : "neutral"
                }
              />
            )}
            {analysis.cash_out_amount_at_75ltv != null && (
              <RefiBlock
                label="Cash-out @ 75% LTV"
                primary={fmtUsd(analysis.cash_out_amount_at_75ltv, 0)}
                secondary={
                  analysis.break_even_months_at_market != null
                    ? `break-even ${Math.round(analysis.break_even_months_at_market)} mo`
                    : "extractable"
                }
                accent={
                  (analysis.cash_out_amount_at_75ltv ?? 0) >= 20_000 ? "good" : "neutral"
                }
              />
            )}
          </div>
        )}

        {analysis.risk_flags.length > 0 && (
          <ul className="mt-3 space-y-1">
            {analysis.risk_flags.map((f, i) => (
              <li
                key={i}
                className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200"
              >
                ⚠ {f}
              </li>
            ))}
          </ul>
        )}

        {analysis.narrative && (
          <div className="mt-3 rounded-lg border border-indigo-400/20 bg-black/30 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/70">
              Ledger-Capital narrative
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
  tone: "good" | "danger" | "neutral";
}) {
  const cls =
    tone === "good"
      ? "text-emerald-200"
      : tone === "danger"
        ? "text-rose-200"
        : "text-indigo-100";
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-white/10 bg-black/20 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/45">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-bold ${cls}`}>{value}</p>
    </div>
  );
}

function RefiBlock({
  label,
  primary,
  secondary,
  accent,
}: {
  label: string;
  primary: string;
  secondary: string;
  accent: "good" | "warning" | "neutral";
}) {
  const ring =
    accent === "good"
      ? "border-emerald-400/30 bg-emerald-500/10"
      : accent === "warning"
        ? "border-amber-400/30 bg-amber-500/10"
        : "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5";
  const head =
    accent === "good" ? "text-emerald-200" : accent === "warning" ? "text-amber-200" : "text-zinc-800 dark:text-white/85";
  return (
    <div className={`rounded-lg border px-3 py-2 ${ring}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/45">
        {label}
      </p>
      <p className={`mt-0.5 text-base font-bold ${head}`}>{primary}</p>
      <p className="text-[10px] text-zinc-500 dark:text-white/50">{secondary}</p>
    </div>
  );
}
