import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getPerUnitPnl, getMortgageBreakdown } from "@/app/actions/ledger";
import { getFullPnl, type PnlPeriod } from "@/app/actions/pnl";

import UnitLedgerGrid from "@/components/UnitLedgerGrid";
import MortgageEquityTracker from "@/components/MortgageEquityTracker";
import AddTransactionModal from "@/components/AddTransactionModal";
import PnlStatement from "@/components/PnlStatement";
import PnlPeriodTabs from "@/components/PnlPeriodTabs";

export const dynamic = "force-dynamic";

const fmtUsd = (n: number, frac = 0) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: frac,
  });

const CATEGORY_BADGE: Record<string, string> = {
  rent: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  late_fees: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  other_income: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  mortgage: "bg-rose-500/20 text-rose-200 border-rose-400/30",
  mortgage_interest: "bg-rose-500/20 text-rose-200 border-rose-400/30",
  mortgage_principal: "bg-blue-500/20 text-blue-200 border-blue-400/30",
  insurance: "bg-rose-500/20 text-rose-200 border-rose-400/30",
  utilities: "bg-rose-500/20 text-rose-200 border-rose-400/30",
  property_tax: "bg-rose-500/20 text-rose-200 border-rose-400/30",
  maintenance: "bg-rose-500/20 text-rose-200 border-rose-400/30",
  pest_control: "bg-rose-500/20 text-rose-200 border-rose-400/30",
  landscaping: "bg-rose-500/20 text-rose-200 border-rose-400/30",
  management: "bg-rose-500/20 text-rose-200 border-rose-400/30",
  other_expense: "bg-rose-500/20 text-rose-200 border-rose-400/30",
};

function resolvePeriod(raw: string | string[] | undefined): PnlPeriod {
  const val = Array.isArray(raw) ? raw[0] : raw;
  if (val === "month" || val === "ttm") return val;
  return "ytd";
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const sp = await searchParams;
  const period = resolvePeriod(sp.period);

  const supabase = await createServerSupabaseClient();
  const [pnl, mortgage, fullPnl] = await Promise.all([
    getPerUnitPnl(),
    getMortgageBreakdown(),
    getFullPnl(period),
  ]);

  const { data: txs } = await supabase
    .from("transactions")
    .select("id, date, description, category, amount, type, unit_id")
    .eq("property_id", pnl?.property_id ?? "00000000-0000-0000-0000-000000000000")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(40);

  const unitNumberById = new Map(
    (pnl?.units ?? []).map((u) => [u.unit_id, u.unit_number])
  );

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--fg)] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Finances
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {pnl?.property_name ?? "Property"} · Full P&amp;L · Live mortgage tracker · Per-unit matrix
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PnlPeriodTabs active={period} />
            <AddTransactionModal
              propertyId={pnl?.property_id ?? null}
              units={(pnl?.units ?? []).map((u) => ({
                id: u.unit_id,
                unit_number: u.unit_number,
              }))}
            />
          </div>
        </header>

        {fullPnl && (
          <section>
            <PnlStatement pnl={fullPnl} />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Mortgage &amp; Equity
          </h2>
          <MortgageEquityTracker initial={mortgage} />
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Per-Unit P&amp;L Matrix
          </h2>
          <UnitLedgerGrid data={pnl} />
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Recent Transactions
          </h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-xl">
            <table className="w-full">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
                <tr>
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th>Unit</Th>
                  <Th>Category</Th>
                  <Th align="right">Amount</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {(txs ?? []).map((t) => (
                  <tr key={t.id} className="text-sm transition hover:bg-zinc-900/60">
                    <td className="px-5 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {new Date(t.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "2-digit",
                        year: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3 text-zinc-800 dark:text-zinc-200">{t.description ?? "—"}</td>
                    <td className="px-5 py-3 text-xs text-zinc-500">
                      {t.unit_id ? `#${unitNumberById.get(t.unit_id) ?? "?"}` : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          CATEGORY_BADGE[t.category] ??
                          (t.type === "income"
                            ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/30"
                            : "bg-rose-500/20 text-rose-200 border-rose-400/30")
                        }`}
                      >
                        {t.category}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono font-semibold ${
                        t.type === "income" ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {t.type === "income" ? "+" : "−"}
                      {fmtUsd(Number(t.amount), 2)}
                    </td>
                  </tr>
                ))}
                {(!txs || txs.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-zinc-500">
                      No transactions yet. Click{" "}
                      <span className="text-blue-300">+ Add Transaction</span> to log your first one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
