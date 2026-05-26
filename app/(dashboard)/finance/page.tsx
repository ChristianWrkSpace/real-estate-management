import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getPerUnitPnl, getMortgageBreakdown } from "@/app/actions/ledger";
import UnitLedgerGrid from "@/components/UnitLedgerGrid";
import MortgageEquityTracker from "@/components/MortgageEquityTracker";
import AddTransactionModal from "@/components/AddTransactionModal";

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
};

export default async function FinancePage() {
  const supabase = await createServerSupabaseClient();

  const [pnl, mortgage] = await Promise.all([getPerUnitPnl(), getMortgageBreakdown()]);

  const { data: txs } = await supabase
    .from("transactions")
    .select("id, date, description, category, amount, type, unit_id")
    .eq("property_id", pnl?.property_id ?? "00000000-0000-0000-0000-000000000000")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  const unitNumberById = new Map((pnl?.units ?? []).map((u) => [u.unit_id, u.unit_number]));

  const totals = pnl?.totals ?? {
    income_ytd: 0,
    expenses_ytd: 0,
    net_cash_flow_ytd: 0,
    common_area_expenses_ytd: 0,
  };

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Finances</h1>
          <p className="mt-1 text-white/60">
            {pnl?.property_name ?? "Property"} · Per-unit P&amp;L matrix · Live mortgage tracker
          </p>
        </div>
        <AddTransactionModal
          propertyId={pnl?.property_id ?? null}
          units={(pnl?.units ?? []).map((u) => ({ id: u.unit_id, unit_number: u.unit_number }))}
        />
      </div>

      {/* Portfolio summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          label="Total Income YTD"
          value={fmtUsd(totals.income_ytd, 2)}
          tone="emerald"
        />
        <SummaryCard
          label="Total Expenses YTD"
          value={fmtUsd(totals.expenses_ytd, 2)}
          tone="rose"
        />
        <SummaryCard
          label="Net Operating Income YTD"
          value={`${totals.net_cash_flow_ytd >= 0 ? "+" : ""}${fmtUsd(totals.net_cash_flow_ytd, 2)}`}
          tone={totals.net_cash_flow_ytd >= 0 ? "blue" : "rose"}
        />
      </div>

      {/* Mortgage + equity tracker */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-white/50">
          Mortgage & Equity
        </h2>
        <MortgageEquityTracker initial={mortgage} />
      </section>

      {/* Per-unit P&L grid */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-white/50">
          Per-Unit P&amp;L Matrix
        </h2>
        <UnitLedgerGrid data={pnl} />
      </section>

      {/* Transaction ledger */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-white/50">
          Recent Transactions
        </h2>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
          <table className="w-full">
            <thead className="border-b border-white/10 bg-white/[0.04]">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/60">
                  Date
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/60">
                  Description
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/60">
                  Unit
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/60">
                  Category
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white/60">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(txs ?? []).map((t) => (
                <tr key={t.id} className="text-sm transition hover:bg-white/[0.03]">
                  <td className="px-5 py-3 text-white/70">
                    {new Date(t.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "2-digit",
                    })}
                  </td>
                  <td className="px-5 py-3 text-white/85">{t.description ?? "—"}</td>
                  <td className="px-5 py-3 text-white/60">
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
                    className={`px-5 py-3 text-right font-semibold ${
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
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-white/40">
                    No transactions yet. Click <span className="text-blue-300">+ Add Transaction</span>{" "}
                    to log your first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "rose" | "blue";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
      : tone === "rose"
        ? "border-rose-500/30 bg-rose-500/5 text-rose-200"
        : "border-blue-500/30 bg-blue-500/5 text-blue-200";
  return (
    <div className={`rounded-xl border p-5 backdrop-blur-xl ${cls}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
