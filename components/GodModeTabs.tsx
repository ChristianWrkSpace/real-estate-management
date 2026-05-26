"use client";

import { useState } from "react";
import TaxIntelligenceCard, { type TaxIntelligenceProps } from "@/components/TaxIntelligenceCard";
import CapitalStrategyCard, { type CapitalStrategyProps } from "@/components/CapitalStrategyCard";
import YieldOptimizationCard, { type YieldOptimizationProps } from "@/components/YieldOptimizationCard";

type TabKey = "capital" | "tax" | "yield";

type Tab = {
  key: TabKey;
  label: string;
  hint: string;
  pill: string;
  glow: string;
  dot: string;
};

const TABS: Tab[] = [
  {
    key: "capital",
    label: "Capital",
    hint: "Refi · equity · LTV",
    pill: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
    glow: "shadow-[0_0_48px_rgba(16,185,129,0.10)]",
    dot: "bg-emerald-400",
  },
  {
    key: "tax",
    label: "Tax",
    hint: "Webb CAD assessment",
    pill: "border-amber-400/40 bg-amber-500/15 text-amber-200",
    glow: "shadow-[0_0_48px_rgba(245,158,11,0.10)]",
    dot: "bg-amber-400",
  },
  {
    key: "yield",
    label: "Yield",
    hint: "ZIP 78040 market rent",
    pill: "border-blue-400/40 bg-blue-500/15 text-blue-200",
    glow: "shadow-[0_0_48px_rgba(59,130,246,0.10)]",
    dot: "bg-blue-400",
  },
];

export type GodModeTabsProps = {
  tax: TaxIntelligenceProps;
  capital: CapitalStrategyProps;
  yieldData: YieldOptimizationProps;
};

export default function GodModeTabs({ tax, capital, yieldData }: GodModeTabsProps) {
  const [active, setActive] = useState<TabKey>("capital");
  const activeTab = TABS.find((t) => t.key === active) ?? TABS[0];

  return (
    <div
      className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 backdrop-blur-md transition-all duration-300 hover:border-zinc-700 ${activeTab.glow}`}
    >
      {/* Tab strip — no border-bottom; selection is shown by the pill color + dot */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${activeTab.dot}`}
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            God Mode
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {TABS.map((tab) => {
            const isActive = tab.key === active;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActive(tab.key)}
                className={`group flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? tab.pill
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900/70 hover:text-zinc-200"
                }`}
                aria-pressed={isActive}
              >
                <span>{tab.label}</span>
                <span className="hidden text-[10px] font-normal opacity-70 md:inline">
                  {tab.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel body — same surface, no divider */}
      <div className="p-5">
        {active === "capital" && <CapitalStrategyCard {...capital} />}
        {active === "tax" && <TaxIntelligenceCard {...tax} />}
        {active === "yield" && <YieldOptimizationCard {...yieldData} />}
      </div>
    </div>
  );
}
