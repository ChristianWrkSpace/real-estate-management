"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getDispatchSuggestion,
  approveAndDispatch,
} from "@/app/actions/dispatch";
import type { DispatchSuggestion } from "@/lib/ai/agents/argus-dispatch";

const fmtUsd = (n: number | null | undefined, frac = 0) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: frac,
      });

const CONFIDENCE_PILL = {
  high: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  medium: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  low: "border-rose-500/40 bg-rose-500/15 text-rose-200",
} as const;

export default function DispatchSuggestionPanel({
  workOrderId,
  isAlreadyAssigned,
}: {
  workOrderId: string;
  isAlreadyAssigned: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<DispatchSuggestion | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Auto-fetch the first time the panel opens
  useEffect(() => {
    if (!open || suggestion || loadingSuggestion) return;
    setLoadingSuggestion(true);
    setError(null);
    getDispatchSuggestion(workOrderId)
      .then((r) => {
        if (r.success && r.suggestion) setSuggestion(r.suggestion);
        else setError(r.error ?? "Could not compute suggestion");
      })
      .finally(() => setLoadingSuggestion(false));
  }, [open, workOrderId, suggestion, loadingSuggestion]);

  const approve = () => {
    if (!suggestion) return;
    setError(null);
    startTransition(async () => {
      const r = await approveAndDispatch({ workOrderId });
      if (r.success) {
        setConfirmation(
          `Dispatched · ${r.vendor_id ? "vendor assigned" : "no vendor"} · estimate ${fmtUsd(r.estimated_cost ?? null)}`
        );
        if (typeof window !== "undefined") {
          // Soft refresh so the Kanban column reflows the WO into "In Progress"
          setTimeout(() => window.location.reload(), 900);
        }
      } else {
        setError(r.error ?? "Dispatch failed");
      }
    });
  };

  if (isAlreadyAssigned && !open) {
    return null; // already dispatched — nothing to suggest
  }

  return (
    <div className="mt-3">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition hover:border-indigo-400/50 hover:bg-indigo-500/20"
        >
          ✦ Argus Dispatch — suggest a vendor
        </button>
      )}

      {open && (
        <div className="rounded-xl border border-indigo-500/30 bg-white dark:bg-zinc-950/80 p-3.5 shadow-[0_0_36px_rgba(99,102,241,0.18)]">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
              ✦ Suggested Dispatch
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              hide
            </button>
          </div>

          {loadingSuggestion && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Analyzing ticket…</p>
          )}

          {suggestion && (
            <>
              {/* Trade classification */}
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-indigo-200">
                  {suggestion.detected_trade}
                </span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${CONFIDENCE_PILL[suggestion.trade_confidence]}`}
                >
                  {suggestion.trade_confidence}
                </span>
                {suggestion.ai_used && (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    haiku
                  </span>
                )}
              </div>

              {/* Vendor match */}
              {suggestion.matched_vendor ? (
                <div className="mb-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-900/70 px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                      {suggestion.matched_vendor.name}
                    </span>
                    {suggestion.matched_vendor.billing_rate != null && (
                      <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        ${suggestion.matched_vendor.billing_rate}/hr
                      </span>
                    )}
                  </div>
                  {suggestion.matched_vendor.phone && (
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {suggestion.matched_vendor.phone}
                      {suggestion.matched_vendor.email
                        ? ` · ${suggestion.matched_vendor.email}`
                        : ""}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                  No registered {suggestion.detected_trade} vendor. Add one or
                  override.
                </div>
              )}

              {/* Cost estimate */}
              <div className="mb-3 grid grid-cols-3 gap-2">
                <Pill
                  label="Low"
                  value={fmtUsd(suggestion.cost_estimate_low_usd)}
                  tone="muted"
                />
                <Pill
                  label="Estimate"
                  value={fmtUsd(
                    Math.round(
                      (suggestion.cost_estimate_low_usd +
                        suggestion.cost_estimate_high_usd) /
                        2
                    )
                  )}
                  tone="primary"
                />
                <Pill
                  label="High"
                  value={fmtUsd(suggestion.cost_estimate_high_usd)}
                  tone="muted"
                />
              </div>

              <p className="mb-3 text-[10px] leading-relaxed text-zinc-500">
                {suggestion.rationale}
              </p>

              {/* CTA */}
              <button
                type="button"
                onClick={approve}
                disabled={isPending || !suggestion.matched_vendor || !!confirmation}
                className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(16,185,129,0.35)] transition hover:from-emerald-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmation
                  ? "✓ Dispatched"
                  : isPending
                    ? "Dispatching…"
                    : "Approve & Dispatch Vendor"}
              </button>
            </>
          )}

          {confirmation && (
            <p className="mt-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-200">
              {confirmation}
            </p>
          )}
          {error && (
            <p className="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">
              ⚠ {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Pill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "muted" | "primary";
}) {
  const cls =
    tone === "primary"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : "border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-300";
  return (
    <div className={`rounded-md border px-2 py-1 ${cls}`}>
      <p className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="font-mono text-xs font-semibold">{value}</p>
    </div>
  );
}
