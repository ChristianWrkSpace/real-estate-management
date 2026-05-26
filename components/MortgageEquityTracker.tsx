"use client";

import { useState, useTransition } from "react";
import {
  applyMortgagePayment,
  updateMortgageProfile,
  type MortgageBreakdown,
} from "@/app/actions/ledger";

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
  const [isApplying, startApply] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [override, setOverride] = useState("");

  // Edit-mode state
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({
    propertyValue: "",
    mortgageBalance: "",
    interestRate: "",
    monthlyPayment: "",
    amortYears: "",
  });

  const openEdit = () => {
    if (!breakdown) return;
    setEdit({
      propertyValue: breakdown.property_value != null ? String(breakdown.property_value) : "",
      mortgageBalance: String(breakdown.mortgage_balance),
      interestRate: String(breakdown.interest_rate_pct),
      monthlyPayment: String(breakdown.scheduled_monthly_payment.toFixed(2)),
      amortYears: String(breakdown.amort_years),
    });
    setEditing(true);
    setError(null);
  };

  const saveEdit = () => {
    setError(null);
    const num = (s: string) => (s.trim() ? Number(s) : null);
    startSave(async () => {
      const r = await updateMortgageProfile({
        propertyValue: num(edit.propertyValue),
        mortgageBalance: num(edit.mortgageBalance),
        interestRatePct: num(edit.interestRate),
        monthlyPayment: num(edit.monthlyPayment),
        amortYears: num(edit.amortYears),
      });
      if (r.success && r.breakdown) {
        setBreakdown(r.breakdown);
        setEditing(false);
        setFlash(true);
        setTimeout(() => setFlash(false), 1800);
      } else {
        setError(r.error || "Save failed");
      }
    });
  };

  const apply = () => {
    setError(null);
    const overrideNum = override.trim() ? Number(override) : undefined;
    if (override.trim() && (!Number.isFinite(overrideNum) || (overrideNum ?? 0) <= 0)) {
      setError("Override amount must be a positive number.");
      return;
    }
    startApply(async () => {
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
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-6 text-center text-sm text-zinc-500 shadow-xl">
        No property data — set value, mortgage balance, and interest rate to enable the
        equity tracker.
      </div>
    );
  }

  const noMortgage = breakdown.mortgage_balance <= 0;
  const equityGained = breakdown.this_month_principal;
  const isPending = isApplying || isSaving;

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white dark:bg-zinc-900/80 p-6 shadow-xl transition-all duration-300 ${
        flash
          ? "border-emerald-400/60 shadow-[0_0_48px_rgba(16,185,129,0.30)]"
          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
            ◢ Mortgage &amp; Equity Tracker
          </span>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {fmtPct(breakdown.interest_rate_pct, 2)} fixed · {breakdown.amort_years}-yr amort
            {breakdown.payment_is_override && (
              <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
                override
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <button
              type="button"
              onClick={openEdit}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900"
            >
              ✎ Edit
            </button>
          )}
          <button
            type="button"
            onClick={apply}
            disabled={isPending || noMortgage || editing}
            className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-40"
          >
            {isApplying ? "Posting…" : "Apply This Month's Payment"}
          </button>
        </div>
      </div>

      {/* KPI strip */}
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
          sub={breakdown.payment_is_override ? "P+I (override)" : "P+I, computed"}
          accent="indigo"
        />
        <Big
          label="Equity gained / mo"
          value={fmtUsd(equityGained, 2)}
          sub="principal portion"
          accent="emerald"
        />
      </div>

      {/* Edit form */}
      {editing && (
        <div className="mb-5 rounded-xl border border-emerald-400/30 bg-white dark:bg-zinc-950/80 p-4 shadow-[0_0_28px_rgba(16,185,129,0.10)]">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-emerald-300">
            Edit Mortgage Profile
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EditField label="Property value (USD)">
              <input
                type="number"
                step="0.01"
                value={edit.propertyValue}
                onChange={(e) => setEdit({ ...edit, propertyValue: e.target.value })}
                className={inputClass}
              />
            </EditField>
            <EditField label="Mortgage balance (USD)">
              <input
                type="number"
                step="0.01"
                value={edit.mortgageBalance}
                onChange={(e) => setEdit({ ...edit, mortgageBalance: e.target.value })}
                className={inputClass}
              />
            </EditField>
            <EditField label="Interest rate (%)">
              <input
                type="number"
                step="0.001"
                value={edit.interestRate}
                onChange={(e) => setEdit({ ...edit, interestRate: e.target.value })}
                className={inputClass}
              />
            </EditField>
            <EditField label="Monthly P+I payment (USD)">
              <input
                type="number"
                step="0.01"
                value={edit.monthlyPayment}
                onChange={(e) => setEdit({ ...edit, monthlyPayment: e.target.value })}
                placeholder="leave blank to use PMT formula"
                className={inputClass}
              />
            </EditField>
            <EditField label="Amortization (years)">
              <input
                type="number"
                step="1"
                min="1"
                max="50"
                value={edit.amortYears}
                onChange={(e) => setEdit({ ...edit, amortYears: e.target.value })}
                className={inputClass}
              />
            </EditField>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={saveEdit}
              disabled={isSaving}
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/15 transition hover:from-emerald-600 hover:to-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={isSaving}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900"
            >
              Cancel
            </button>
            <p className="text-[10px] text-zinc-500">
              Save recomputes the principal/interest split live and writes to
              ai_logs.
            </p>
          </div>
        </div>
      )}

      {/* Principal/interest split bar */}
      {!noMortgage && !editing && (
        <PrincipalInterestSplit
          principal={breakdown.this_month_principal}
          interest={breakdown.this_month_interest}
          payment={breakdown.scheduled_monthly_payment}
        />
      )}

      {/* Override field for one-off payments */}
      {!noMortgage && !editing && (
        <div className="mt-4 flex items-center gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            One-time override
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            placeholder={breakdown.scheduled_monthly_payment.toFixed(2)}
            className="w-36 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-none"
          />
          <span className="text-[11px] text-zinc-500">
            blank = use scheduled
          </span>
        </div>
      )}

      {flash && !editing && (
        <div className="mt-4 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100">
          ✓ Saved — equity grew by{" "}
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
  );
}

const inputClass =
  "w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm font-mono placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-60";

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
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
      ? "text-emerald-400"
      : accent === "indigo"
        ? "text-indigo-300"
        : "text-zinc-900 dark:text-zinc-100";
  return (
    <div
      className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 transition ${
        flash && accent === "emerald" ? "scale-[1.02] shadow-[0_0_24px_rgba(16,185,129,0.4)]" : ""
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 font-mono text-2xl font-bold ${cls}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-zinc-500">{sub}</p>
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
      <div className="mb-2 flex items-baseline justify-between text-[11px] uppercase tracking-wider text-zinc-500">
        <span>This month&apos;s split</span>
        <span className="font-mono">Total {fmtUsd(payment, 2)}</span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
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
          ● Principal{" "}
          <span className="font-mono font-semibold">{fmtUsd(principal, 2)}</span>{" "}
          <span className="text-zinc-500">({principalPct.toFixed(1)}%)</span>
        </span>
        <span className="text-rose-300">
          ● Interest{" "}
          <span className="font-mono font-semibold">{fmtUsd(interest, 2)}</span>{" "}
          <span className="text-zinc-500">({interestPct.toFixed(1)}%)</span>
        </span>
      </div>
    </div>
  );
}
