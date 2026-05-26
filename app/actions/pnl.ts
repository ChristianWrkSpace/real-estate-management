"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getMortgageBreakdown } from "@/app/actions/ledger";

// ─────────────────────────────────────────────────────────────────────────────
// Category buckets
// ─────────────────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES = ["rent", "late_fees", "other_income"] as const;

/** Above-the-NOI-line operating expenses. */
const OPEX_CATEGORIES = [
  "property_tax",
  "insurance",
  "utilities",
  "maintenance",
  "pest_control",
  "landscaping",
  "management",
  "other_expense",
] as const;

/** Below-the-NOI-line — debt service. */
const INTEREST_CATEGORIES = ["mortgage_interest", "mortgage"] as const;
const PRINCIPAL_CATEGORIES = ["mortgage_principal"] as const;

const CATEGORY_LABEL: Record<string, string> = {
  rent: "Rent",
  late_fees: "Late Fees",
  other_income: "Other Income",
  property_tax: "Property Tax",
  insurance: "Insurance",
  utilities: "Utilities",
  maintenance: "Maintenance & Repairs",
  pest_control: "Pest Control",
  landscaping: "Landscaping",
  management: "Management",
  other_expense: "Other Expense",
  mortgage_interest: "Mortgage Interest",
  mortgage_principal: "Principal Pay-Down (equity build)",
  mortgage: "Mortgage (legacy)",
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PnlLine = {
  category: string;
  label: string;
  amount: number;
  count: number;
};

export type PnlBundle = {
  property_id: string;
  property_name: string;
  period_label: string;          // e.g. "May 2026" or "YTD 2026" or "Trailing 12mo"
  period_start: string;          // YYYY-MM-DD
  period_end: string;            // YYYY-MM-DD
  months_in_period: number;

  // Income
  income_lines: PnlLine[];
  income_total: number;
  gross_rent: number;
  scheduled_rent_period: number;    // sum of all active leases' monthly_rent × months_in_period
  collection_rate_pct: number | null;

  // Operating expenses (above NOI)
  opex_lines: PnlLine[];
  opex_total: number;
  uncategorized_opex_total: number; // catch-all for unknown categories

  // NOI
  noi_period: number;
  noi_annualized: number;
  operating_expense_ratio_pct: number | null;

  // Debt service (below NOI)
  mortgage_interest_period: number;
  mortgage_principal_period: number;
  total_debt_service_period: number;

  // Cash flow + equity
  pre_tax_cash_flow_period: number;
  pre_tax_cash_flow_annualized: number;
  equity_built_period: number;     // principal portion logged in period

  // Valuation / ratios
  property_value: number | null;
  mortgage_balance: number | null;
  equity: number | null;
  cap_rate_pct: number | null;     // annualized NOI / property value
  cash_on_cash_pct: number | null; // annualized cash flow / equity
  grm: number | null;              // property value / annual gross rent
  dscr: number | null;             // annualized NOI / annual debt service

  // Forward-looking reserves
  recommended_capex_reserve: number; // 10% of annualized gross income
  recommended_tax_reserve: number;   // 30% of annualized pre-tax cash flow
  emergency_reserve_target: number;  // 6× monthly opex

  generated_at: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type TxRow = { type: string; category: string; amount: number; date: string };

function startOfMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function startOfYear(d = new Date()): string {
  return `${d.getFullYear()}-01-01`;
}
function lastDayOfMonth(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return x.toISOString().split("T")[0];
}
function isoDate(d = new Date()): string {
  return d.toISOString().split("T")[0];
}
function monthsBetween(startIso: string, endIso: string): number {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  return Math.max(1 / 12, (b - a) / (365.25 * 24 * 3600 * 1000) * 12);
}

function sumLines(txs: TxRow[], categorySet: readonly string[], type: "income" | "expense"): {
  lines: PnlLine[];
  total: number;
} {
  const map = new Map<string, { sum: number; count: number }>();
  for (const t of txs) {
    if (t.type !== type) continue;
    if (!categorySet.includes(t.category)) continue;
    const cur = map.get(t.category) ?? { sum: 0, count: 0 };
    cur.sum += Number(t.amount);
    cur.count += 1;
    map.set(t.category, cur);
  }
  const lines: PnlLine[] = categorySet
    .map((c) => {
      const m = map.get(c);
      if (!m || m.sum === 0) return null;
      return {
        category: c,
        label: CATEGORY_LABEL[c] ?? c,
        amount: m.sum,
        count: m.count,
      };
    })
    .filter(Boolean) as PnlLine[];
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entrypoint
// ─────────────────────────────────────────────────────────────────────────────

export type PnlPeriod = "month" | "ytd" | "ttm";

export async function getFullPnl(period: PnlPeriod = "ytd"): Promise<PnlBundle | null> {
  const supabase = await createServerSupabaseClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, current_value, mortgage_balance, monthly_payment, interest_rate, amort_years")
    .limit(1)
    .maybeSingle();
  if (!property) return null;

  // ── Period window ──────────────────────────────────────────────────────
  const now = new Date();
  const periodEnd = isoDate(now);
  let periodStart: string;
  let periodLabel: string;
  if (period === "month") {
    periodStart = startOfMonth(now);
    periodLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  } else if (period === "ttm") {
    const back = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    periodStart = isoDate(back);
    periodLabel = "Trailing 12 months";
  } else {
    periodStart = startOfYear(now);
    periodLabel = `YTD ${now.getFullYear()}`;
  }
  const monthsInPeriod = monthsBetween(periodStart, periodEnd);

  // ── Transactions in window ─────────────────────────────────────────────
  const { data: txData } = await supabase
    .from("transactions")
    .select("type, category, amount, date")
    .eq("property_id", property.id)
    .gte("date", periodStart)
    .lte("date", periodEnd);
  const txs = (txData ?? []) as TxRow[];

  // ── Income lines ───────────────────────────────────────────────────────
  const incomeAgg = sumLines(txs, INCOME_CATEGORIES, "income");
  const grossRent = incomeAgg.lines.find((l) => l.category === "rent")?.amount ?? 0;

  // Scheduled rent for the period = sum of active leases × months in period
  const { data: leases } = await supabase
    .from("leases")
    .select("monthly_rent")
    .eq("status", "active");
  const scheduledMonthly = (leases ?? []).reduce(
    (s, l) => s + Number(l.monthly_rent ?? 0),
    0
  );
  const scheduledRentPeriod = scheduledMonthly * monthsInPeriod;
  const collectionRatePct =
    scheduledRentPeriod > 0 ? (grossRent / scheduledRentPeriod) * 100 : null;

  // ── Operating expenses ─────────────────────────────────────────────────
  const opexAgg = sumLines(txs, OPEX_CATEGORIES, "expense");

  // Catch-all for any expense category we don't recognize
  const knownExpenseCats = new Set<string>([
    ...OPEX_CATEGORIES,
    ...INTEREST_CATEGORIES,
    ...PRINCIPAL_CATEGORIES,
  ]);
  const uncategorizedOpex = txs
    .filter((t) => t.type === "expense" && !knownExpenseCats.has(t.category))
    .reduce((s, t) => s + Number(t.amount), 0);
  const opexTotal = opexAgg.total + uncategorizedOpex;

  // ── Debt service ───────────────────────────────────────────────────────
  const interestAgg = sumLines(txs, INTEREST_CATEGORIES, "expense");
  const principalAgg = sumLines(txs, PRINCIPAL_CATEGORIES, "expense");

  const mortInterestPeriod = interestAgg.total;
  const mortPrincipalPeriod = principalAgg.total;
  const totalDebtServicePeriod = mortInterestPeriod + mortPrincipalPeriod;

  // ── NOI + cash flow ────────────────────────────────────────────────────
  const noiPeriod = incomeAgg.total - opexTotal;
  const annualScale = 12 / Math.max(monthsInPeriod, 1 / 12);
  const noiAnnualized = noiPeriod * annualScale;
  const preTaxCashFlow = noiPeriod - totalDebtServicePeriod;
  const preTaxCashFlowAnnualized = preTaxCashFlow * annualScale;
  const operatingExpenseRatioPct =
    incomeAgg.total > 0 ? (opexTotal / incomeAgg.total) * 100 : null;

  // ── Valuation / ratios ────────────────────────────────────────────────
  const propertyValue =
    property.current_value != null ? Number(property.current_value) : null;
  const mortgageBalance =
    property.mortgage_balance != null ? Number(property.mortgage_balance) : null;
  const equity =
    propertyValue != null && mortgageBalance != null
      ? propertyValue - mortgageBalance
      : null;

  const annualGrossRent = grossRent * annualScale;
  const annualDebtService = totalDebtServicePeriod * annualScale;
  const capRatePct =
    propertyValue && propertyValue > 0 ? (noiAnnualized / propertyValue) * 100 : null;
  const cocPct =
    equity && equity > 0 ? (preTaxCashFlowAnnualized / equity) * 100 : null;
  const grm = annualGrossRent > 0 && propertyValue ? propertyValue / annualGrossRent : null;
  const dscr = annualDebtService > 0 ? noiAnnualized / annualDebtService : null;

  // Pull live scheduled P+I in case the user hasn't logged this month's mortgage txns yet
  const breakdown = await getMortgageBreakdown();
  const scheduledMonthlyDebt = breakdown?.scheduled_monthly_payment ?? 0;

  // ── Forward-looking reserves ──────────────────────────────────────────
  const annualIncome = incomeAgg.total * annualScale;
  const monthlyOpex = opexTotal / Math.max(monthsInPeriod, 1 / 12);
  const recommendedCapex = annualIncome * 0.1;
  const recommendedTax = Math.max(0, preTaxCashFlowAnnualized * 0.3);
  const emergencyReserve = monthlyOpex * 6;

  return {
    property_id: property.id,
    property_name: property.name,
    period_label: periodLabel,
    period_start: periodStart,
    period_end: periodEnd,
    months_in_period: monthsInPeriod,

    income_lines: incomeAgg.lines,
    income_total: incomeAgg.total,
    gross_rent: grossRent,
    scheduled_rent_period: scheduledRentPeriod,
    collection_rate_pct: collectionRatePct,

    opex_lines: opexAgg.lines,
    opex_total: opexTotal,
    uncategorized_opex_total: uncategorizedOpex,

    noi_period: noiPeriod,
    noi_annualized: noiAnnualized,
    operating_expense_ratio_pct: operatingExpenseRatioPct,

    mortgage_interest_period: mortInterestPeriod,
    mortgage_principal_period: mortPrincipalPeriod,
    total_debt_service_period:
      totalDebtServicePeriod > 0 ? totalDebtServicePeriod : scheduledMonthlyDebt * monthsInPeriod,

    pre_tax_cash_flow_period: preTaxCashFlow,
    pre_tax_cash_flow_annualized: preTaxCashFlowAnnualized,
    equity_built_period: mortPrincipalPeriod,

    property_value: propertyValue,
    mortgage_balance: mortgageBalance,
    equity,
    cap_rate_pct: capRatePct,
    cash_on_cash_pct: cocPct,
    grm,
    dscr,

    recommended_capex_reserve: recommendedCapex,
    recommended_tax_reserve: recommendedTax,
    emergency_reserve_target: emergencyReserve,

    generated_at: new Date().toISOString(),
  };
}
