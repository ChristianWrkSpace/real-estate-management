"use client";

import { useState } from "react";
import TaxIntelligenceCard, { type TaxIntelligenceProps } from "@/components/TaxIntelligenceCard";
import CapitalStrategyCard, { type CapitalStrategyProps } from "@/components/CapitalStrategyCard";
import YieldOptimizationCard, { type YieldOptimizationProps } from "@/components/YieldOptimizationCard";

type TabKey = "capital" | "tax" | "yield";

const TABS: {
  key: TabKey;
  label: string;
  hint: string;
  /** active tab pill colors */
  pill: string;
  /** outer panel glow ring when active */
  glow: string;
}[] = [
  {
    key: "capital",
    label: "Capital",
    hint: "Refi / equity / LTV",
    pill: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
    glow: "border-emerald-400/25 shadow-[0_0_44px_rgba(16,185,129,0.10)]",
  },
  {
    key: "tax",
    label: "Tax",
    hint: "Webb CAD assessment",
    pill: "border-amber-400/40 bg-amber-500/15 text-amber-200",
    glow: "border-amber-400/25 shadow-[0_0_44px_rgba(245,158,11,0.10)]",
  },
  {
    key: "yield",
    label: "Yield",
    hint: "ZIP 78040 market rent",
    pill: "border-blue-400/40 bg-blue-500/15 text-blue-200",
    glow: "border-blue-400/25 shadow-[0_0_44px_rgba(59,130,246,0.10)]",
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
      className={`overflow-hidden rounded-xl border bg-white/[0.03] backdrop-blur-xl transition-all duration-300 ${activeTab.glow}`}
    >
      {/* Tab strip */}
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.02] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            ◢ God Mode
          </span>
        </div>
        <div className="flex items-center gap-1">
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
                    : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-zinc-200"
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

      {/* Panel body */}
      <div className="p-5">
        {active === "capital" && <CapitalStrategyCard {...capital} />}
        {active === "tax" && <TaxIntelligenceCard {...tax} />}
        {active === "yield" && <YieldOptimizationCard {...yieldData} />}
      </div>
    </div>
  );
}
