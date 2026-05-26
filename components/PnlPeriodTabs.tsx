"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const PERIODS = [
  { key: "month", label: "This Month" },
  { key: "ytd", label: "YTD" },
  { key: "ttm", label: "Trailing 12mo" },
] as const;

export default function PnlPeriodTabs({ active }: { active: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setPeriod = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", key);
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1">
      {PERIODS.map((p) => {
        const isActive = p.key === active;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            disabled={isPending}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              isActive
                ? "bg-emerald-500/15 text-emerald-200"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
