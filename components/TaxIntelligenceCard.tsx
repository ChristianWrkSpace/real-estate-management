"use client";

import { useState, useTransition } from "react";
import { syncWebbCountyTaxData } from "@/app/actions/tax";

type Cad = {
  status: string;
  tax_year: number | null;
  assessed_market_value: number | null;
  assessed_taxable_value: number | null;
  tax_levy_current_year: number | null;
  protest_deadline: string | null;
  cad_account_number: string | null;
  source_url: string | null;
  notes: string[];
  fetched_at: string;
  parsed_by_model?: string | null;
} | null;

type Delta = {
  market_value: number | null;
  taxable_value: number | null;
  tax_levy: number | null;
} | null;

export type TaxIntelligenceProps = {
  initialCad: Cad;
  initialDelta: Delta;
  internalValue: number | null;
  syncedAt: string | null;
  protestDeadline: string | null;
};

const fmtUsd = (n: number | null | undefined, frac = 0) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: frac,
      });

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(date).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function TaxIntelligenceCard({
  initialCad,
  initialDelta,
  internalValue,
  syncedAt,
  protestDeadline,
}: TaxIntelligenceProps) {
  const [cad, setCad] = useState<Cad>(initialCad);
  const [delta, setDelta] = useState<Delta>(initialDelta);
  const [synced, setSynced] = useState<string | null>(syncedAt);
  const [deadline, setDeadline] = useState<string | null>(protestDeadline);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sync = () => {
    setError(null);
    startTransition(async () => {
      const r = await syncWebbCountyTaxData();
      if (r.success && r.data) {
        setCad({
          status: r.data.status,
          tax_year: r.data.tax_year,
          assessed_market_value: r.data.assessed_market_value,
          assessed_taxable_value: r.data.assessed_taxable_value,
          tax_levy_current_year: r.data.tax_levy_current_year,
          protest_deadline: r.data.protest_deadline,
          cad_account_number: r.data.cad_account_number,
          source_url: r.data.source_url,
          notes: r.data.notes,
          fetched_at: r.data.fetched_at,
          parsed_by_model: r.data.parsed_by_model,
        });
        setDelta(r.delta ?? null);
        setSynced(r.data.fetched_at);
        if (r.data.protest_deadline) setDeadline(r.data.protest_deadline);
      } else {
        setError(r.error || "Sync failed");
      }
    });
  };

  const assessed = cad?.assessed_market_value ?? null;
  const internalVsCad =
    internalValue != null && assessed != null ? internalValue - assessed : null;
  const internalVsCadPct =
    internalValue != null && assessed && assessed > 0
      ? ((internalValue - assessed) / assessed) * 100
      : null;

  const deadlineDays = daysUntil(deadline);
  const deadlineUrgent = deadlineDays != null && deadlineDays >= 0 && deadlineDays <= 30;

  return (
    <div className="mt-4 rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-amber-500/5 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300/80">
            ⛨ Tax Intelligence
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-white/40">· Webb CAD</span>
          {cad?.tax_year && (
            <span className="rounded bg-zinc-200/60 dark:bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:text-white/60">
              {cad.tax_year}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={sync}
          disabled={isPending}
          className="rounded-md border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
        >
          {isPending ? "Syncing…" : cad ? "Re-sync" : "Sync Now"}
        </button>
      </div>

      {!cad && !isPending && (
        <p className="text-xs text-zinc-500 dark:text-white/50">
          No CAD data yet. Click <span className="text-amber-300">Sync Now</span> to pull
          Webb County's assessment.
        </p>
      )}

      {cad && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MicroMetric label="CAD Market" value={fmtUsd(cad.assessed_market_value)} />
            <MicroMetric label="CAD Taxable" value={fmtUsd(cad.assessed_taxable_value)} />
            <MicroMetric label="Tax Levy" value={fmtUsd(cad.tax_levy_current_year, 2)} />
            <MicroMetric label="Internal" value={fmtUsd(internalValue)} accent="indigo" />
          </div>

          {internalVsCad != null && (
            <div className="mt-3 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 px-3 py-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-medium text-zinc-600 dark:text-white/60">
                  Internal vs CAD market delta
                </span>
                <span
                  className={`text-sm font-bold ${
                    internalVsCad >= 0 ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {internalVsCad >= 0 ? "+" : ""}
                  {fmtUsd(internalVsCad)}{" "}
                  <span className="text-[11px] font-normal text-zinc-500 dark:text-white/40">
                    ({internalVsCadPct != null ? `${internalVsCadPct >= 0 ? "+" : ""}${internalVsCadPct.toFixed(1)}%` : "—"})
                  </span>
                </span>
              </div>
              <p className="mt-1 text-[10px] text-zinc-500 dark:text-white/40">
                {internalVsCad > 0
                  ? "Your internal estimate exceeds the county's — protest leverage available."
                  : internalVsCad < 0
                    ? "County assessed above your internal estimate — consider re-marking."
                    : "Internal and CAD valuations agree."}
              </p>
            </div>
          )}

          {deadline && (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 ${
                deadlineUrgent
                  ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                  : "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-white/70"
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold uppercase tracking-wide">
                  ⏳ Protest deadline
                </span>
                <span className="font-bold">
                  {deadline}
                  {deadlineDays != null && (
                    <span className="ml-2 text-[10px] opacity-80">
                      ({deadlineDays >= 0 ? `${deadlineDays}d left` : `${Math.abs(deadlineDays)}d past`})
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {delta && (delta.market_value || delta.tax_levy) ? (
            <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
              <DeltaPill label="Δ Market" value={delta.market_value} />
              <DeltaPill label="Δ Taxable" value={delta.taxable_value} />
              <DeltaPill label="Δ Levy" value={delta.tax_levy} fractionDigits={2} />
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500 dark:text-white/40">
            <span>
              Synced {relativeTime(synced)}
              {cad.parsed_by_model && ` · parsed by ${cad.parsed_by_model}`}
            </span>
            {cad.source_url && (
              <a
                href={cad.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-300 underline-offset-2 hover:underline"
              >
                source ↗
              </a>
            )}
          </div>
        </>
      )}

      {error && (
        <p className="mt-2 rounded border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
          ⚠ {error}
        </p>
      )}

      {cad?.notes?.length ? (
        <p className="mt-2 text-[10px] text-zinc-500 dark:text-white/40">
          {cad.notes.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function MicroMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "indigo";
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-white/10 bg-black/20 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/45">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-bold ${
          accent === "indigo" ? "text-indigo-200" : "text-amber-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DeltaPill({
  label,
  value,
  fractionDigits = 0,
}: {
  label: string;
  value: number | null;
  fractionDigits?: number;
}) {
  if (value == null || value === 0) return null;
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${
        positive
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
          : "border-rose-400/30 bg-rose-500/10 text-rose-200"
      }`}
    >
      {label}: {positive ? "+" : ""}
      {fmtUsd(value, fractionDigits)}
    </span>
  );
}
