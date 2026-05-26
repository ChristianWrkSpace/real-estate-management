"use client";

import { useState, useTransition } from "react";
import { generateNoticeToVacate } from "@/app/actions/legal";

export type EnforcementProps = {
  leaseId: string | null;
  isDelinquent: boolean;
  pastDueAmount: number;
  unitNumber: string | null;
};

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export default function EnforcementMenu({
  leaseId,
  isDelinquent,
  pastDueAmount,
  unitNumber,
}: EnforcementProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ url: string; vacateBy: string } | null>(null);

  if (!leaseId) {
    return <span className="text-[10px] text-white/30">No active lease</span>;
  }

  const issue = () => {
    setError(null);
    setSuccess(null);
    if (!confirm(
      `Issue a Texas 3-Day Notice to Vacate for Unit ${unitNumber ?? "?"}?\n\n` +
      `Past-due balance: ${fmtUsd(pastDueAmount)}\n\n` +
      `This is a legal predicate to eviction under Texas Property Code § 24.005. ` +
      `Make sure all good-faith collection attempts have been exhausted first.`
    )) return;

    startTransition(async () => {
      const r = await generateNoticeToVacate({ leaseId });
      if (r.success && r.url) {
        setSuccess({ url: r.url, vacateBy: r.vacate_by ?? "" });
      } else {
        setError(r.error || "Notice generation failed");
      }
    });
  };

  return (
    <div className="relative flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
          isDelinquent
            ? "border-rose-400/50 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
            : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
        }`}
      >
        {isDelinquent ? `Enforcement · ${fmtUsd(pastDueAmount)} due` : "Enforcement ▾"}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-white/10 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-xl">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/50">
            Enforcement Options
          </p>

          {isDelinquent ? (
            <>
              <button
                type="button"
                onClick={issue}
                disabled={isPending}
                className="w-full rounded-lg bg-gradient-to-r from-rose-600 to-red-700 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition hover:from-rose-700 hover:to-red-800 disabled:opacity-50"
              >
                {isPending ? "Generating…" : `Generate 3-Day Notice to Vacate`}
              </button>
              <p className="mt-2 text-[10px] text-white/45">
                Texas Property Code § 24.005. Statutory prerequisite to a forcible-detainer
                suit in Webb County Justice Court. Past-due: <strong>{fmtUsd(pastDueAmount)}</strong>.
              </p>
            </>
          ) : (
            <p className="text-[11px] text-emerald-200/80">
              ✓ Tenant is current on rent — no enforcement actions available.
            </p>
          )}

          {success && (
            <div className="mt-3 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-200">
              ✓ Notice issued. Vacate by <strong>{success.vacateBy}</strong>.
              <a
                href={success.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 underline-offset-2 hover:underline"
              >
                Download PDF ↗
              </a>
            </div>
          )}

          {error && (
            <p className="mt-2 rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[10px] text-rose-200">
              ⚠ {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 w-full rounded text-[10px] text-white/40 hover:text-white/60"
          >
            close
          </button>
        </div>
      )}
    </div>
  );
}
