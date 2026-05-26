"use client";

import { useState } from "react";
import UnitEditDrawer, { type UnitDrawerData } from "@/components/UnitEditDrawer";

const fmtUsd = (n: number | null) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });

const STATUS_TONE: Record<string, { dot: string; pill: string; glow: string }> = {
  occupied: {
    dot: "bg-emerald-400",
    pill: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
    glow: "hover:shadow-[0_0_28px_rgba(16,185,129,0.12)]",
  },
  vacant: {
    dot: "bg-amber-400",
    pill: "border-amber-500/40 bg-amber-500/15 text-amber-200",
    glow: "hover:shadow-[0_0_28px_rgba(245,158,11,0.14)]",
  },
  maintenance: {
    dot: "bg-rose-400",
    pill: "border-rose-500/40 bg-rose-500/15 text-rose-200",
    glow: "hover:shadow-[0_0_28px_rgba(244,63,94,0.14)]",
  },
};

export default function UnitsGrid({ units }: { units: UnitDrawerData[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = units.find((u) => u.id === activeId) ?? null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {units.map((u) => {
          const tone = STATUS_TONE[u.status] ?? STATUS_TONE.vacant;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setActiveId(u.id)}
              className={`group bg-zinc-900/80 border border-zinc-800 p-6 rounded-xl shadow-xl text-left transition hover:border-zinc-700 ${tone.glow}`}
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-100">
                    Unit {u.unit_number}
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {u.bedrooms ?? "?"}BR · {u.bathrooms ?? "?"}BA
                    {u.sqft ? ` · ${u.sqft} sqft` : ""}
                  </p>
                </div>
                <span
                  className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${tone.pill}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  {u.status}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-zinc-300">
                  <span className="text-xs text-zinc-500">Rent · </span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {fmtUsd(u.monthly_rent)}
                  </span>
                  <span className="text-xs text-zinc-500">/mo</span>
                </p>
                {u.tenant_name && (
                  <p className="truncate text-xs text-zinc-400" title={u.tenant_name}>
                    👤 {u.tenant_name}
                  </p>
                )}
                {u.notes && (
                  <p className="line-clamp-2 text-[11px] italic text-zinc-500" title={u.notes ?? ""}>
                    {u.notes}
                  </p>
                )}
              </div>

              <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 opacity-0 transition group-hover:opacity-100">
                Click to edit →
              </p>
            </button>
          );
        })}
      </div>

      <UnitEditDrawer
        open={!!active}
        unit={active}
        onClose={() => setActiveId(null)}
      />
    </>
  );
}
