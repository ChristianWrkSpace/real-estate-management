"use client";

import { useState, useTransition } from "react";
import { applyMortgagePayment } from "@/app/actions/ledger";
import type { MortgageBreakdown } from "@/app/actions/ledger";

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

export default function MortgageEquityTracker({
  initial,
}: {
  initial: MortgageBreakdown | null;
}) {
  const [breakdown, setBreakdown] = useState<MortgageBreakdown | null>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [override, setOverride] = useState("");

  const apply = () => {
    setError(null);
    const overrideNum = override.trim() ? Number(override) : undefined;
    if (override.trim() && (!Number.isFinite(overrideNum) || (overrideNum ?? 0) <= 0)) {
      setError("Override amount must be a positive number.");
      return;
    }
    startTransition(async () => {
      const r = await applyMortgagePayment(overrideNum);
      if (r.success && r.breakdown) {
        setBreakdown(r.breakdown);
        setOverride("");
        setFlash(true);
        setTimeout(() => setFlash(false), 1800);
      } else {
        setError(r.error || "Payment failed");
      }
    });
  };

  if (!breakdown) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/40 backdrop-blur-sm">
        No property data — set value, mortgage balance, and interest rate to enable the
        equity tracker.
      </div>
    );
  }

  const noMortgage = breakdown.mortgage_balance <= 0;
  const equityGained = breakdown.this_month_principal;

  return (
    <div
      className={`overflow-hidden rounded-2xl border backdrop-blur-2xl transition ${
        flash
          ? "border-emerald-400/60 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.25)]"
          : "border-white/10 bg-gradient-to-br from-slate-900/40 via-emerald-950/20 to-slate-900/40"
      }`}
    >
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300/80">
              ◢ Mortgage & Equity Tracker
            </span>
            <p className="mt-1 text-xs text-white/50">
              {fmtPct(breakdown.interest_rate_pct, 2)} fixed · {breakdown.amort_years}-yr amort
            </p>
          </div>
          <button
            type="button"
            onClick={apply}
            disabled={isPending || noMortgage}
            className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-40"
          >
            {isPending ? "Posting…" : "Apply This Month's Payment"}
          </button>
        </div>

        {/* Top KPI strip */}
        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Big
            label="Current equity"
            value={fmtUsd(breakdown.current_equity)}
            sub={`LTV ${fmtPct(breakdown.current_ltv_pct, 1)}`}
            accent="emerald"
            flash={flash}
          />
          <Big
            label="Mortgage balance"
            value={fmtUsd(breakdown.mortgage_balance, 2)}
            sub={fmtUsd(breakdown.property_value) + " value"}
            accent="white"
          />
          <Big
            label="Scheduled payment"
            value={fmtUsd(breakdown.scheduled_monthly_payment, 2)}
            sub="P+I, this month"
            accent="indigo"
          />
          <Big
            label="Equity gained / mo"
            value={fmtUsd(equityGained, 2)}
            sub="principal portion"
            accent="emerald"
          />
        </div>

        {/* Principal/interest split bar */}
        {!noMortgage && (
          <PrincipalInterestSplit
            principal={breakdown.this_month_principal}
            interest={breakdown.this_month_interest}
            payment={breakdown.scheduled_monthly_payment}
          />
        )}

        {/* Override field */}
        {!noMortgage && (
          <div className="mt-4 flex items-center gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
              Override payment
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={override}
              onChange={(e) => setOverride(e.target.value)}
              placeholder={breakdown.scheduled_monthly_payment.toFixed(2)}
              className="w-36 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none"
            />
            <span className="text-[11px] text-white/40">
              (leave blank to use scheduled)
            </span>
          </div>
        )}

        {flash && (
          <div className="mt-4 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100">
            ✓ Payment posted — equity grew by{" "}
            <span className="font-bold">{fmtUsd(equityGained, 2)}</span>. New balance:{" "}
            {fmtUsd(breakdown.mortgage_balance, 2)}.
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            ⚠ {error}
          </p>
        )}
      </div>
    </div>
  );
}

function Big({
  label,
  value,
  sub,
  accent,
  flash,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "emerald" | "white" | "indigo";
  flash?: boolean;
}) {
  const cls =
    accent === "emerald"
      ? "text-emerald-200"
      : accent === "indigo"
        ? "text-indigo-200"
        : "text-white";
  return (
    <div
      className={`rounded-xl border border-white/10 bg-black/20 p-4 transition ${
        flash && accent === "emerald" ? "scale-[1.02] shadow-[0_0_20px_rgba(16,185,129,0.4)]" : ""
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${cls}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-white/40">{sub}</p>
    </div>
  );
}

function PrincipalInterestSplit({
  principal,
  interest,
  payment,
}: {
  principal: number;
  interest: number;
  payment: number;
}) {
  const total = principal + interest;
  if (total === 0) return null;
  const principalPct = (principal / total) * 100;
  const interestPct = 100 - principalPct;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-[11px] uppercase tracking-wider text-white/50">
        <span>This month's split</span>
        <span>Total {fmtUsd(payment, 2)}</span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="flex items-center justify-center bg-gradient-to-r from-emerald-500 to-emerald-400"
          style={{ width: `${principalPct}%` }}
          title={`Principal: ${fmtUsd(principal, 2)}`}
        />
        <div
          className="flex items-center justify-center bg-gradient-to-r from-rose-500 to-rose-400"
          style={{ width: `${interestPct}%` }}
          title={`Interest: ${fmtUsd(interest, 2)}`}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs">
        <span className="text-emerald-300">
          ● Principal {fmtUsd(principal, 2)}{" "}
          <span className="text-white/40">({principalPct.toFixed(1)}%)</span>
        </span>
        <span className="text-rose-300">
          ● Interest {fmtUsd(interest, 2)}{" "}
          <span className="text-white/40">({interestPct.toFixed(1)}%)</span>
        </span>
      </div>
    </div>
  );
}
