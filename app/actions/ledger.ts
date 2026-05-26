"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";

const DEFAULT_AMORT_YEARS = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Per-unit P&L matrix
// ─────────────────────────────────────────────────────────────────────────────

export type UnitPnlRow = {
  unit_id: string;
  unit_number: string;
  bedrooms: number | null;
  bathrooms: number | null;
  status: string;
  monthly_rent: number | null;        // posted on units row
  scheduled_rent: number | null;      // active lease rent (truth)
  tenant_name: string | null;
  rent_status: "paid" | "partial" | "due" | "vacant"; // current month
  income_ytd: number;
  expenses_ytd: number;
  net_cash_flow_ytd: number;
  /**
   * Annualized net unit yield as a percent of annualized scheduled rent.
   * = (annualized NOI / (scheduled_rent × 12)) × 100.
   * Null when scheduled rent is unknown or zero.
   */
  net_yield_pct: number | null;
  last_rent_payment_at: string | null;
  last_expense_at: string | null;
  open_work_orders: number;
};

export type PerUnitPnl = {
  property_id: string;
  property_name: string;
  as_of: string;
  units: UnitPnlRow[];
  totals: {
    income_ytd: number;
    expenses_ytd: number;
    common_area_expenses_ytd: number; // expenses with no unit_id
    net_cash_flow_ytd: number;
  };
};

type TxRow = {
  unit_id: string | null;
  amount: number | string;
  type: "income" | "expense";
  category: string;
  date: string;
};

type LeaseRow = {
  unit_id: string;
  monthly_rent: number | string;
  tenant_id: string;
  status: string;
  start_date: string;
};

type WoRow = { unit_id: string | null; status: string };

export async function getPerUnitPnl(): Promise<PerUnitPnl | null> {
  const supabase = await createServerSupabaseClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id, name")
    .limit(1)
    .maybeSingle();
  if (!property) return null;

  const startOfYear = `${new Date().getFullYear()}-01-01`;
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed
  const firstOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
  const todayIso = today.toISOString().split("T")[0];

  const [unitsRes, txRes, leasesRes, tenantsRes, woRes] = await Promise.all([
    supabase
      .from("units")
      .select("id, unit_number, bedrooms, bathrooms, status, monthly_rent")
      .eq("property_id", property.id)
      .order("unit_number"),
    supabase
      .from("transactions")
      .select("unit_id, amount, type, category, date")
      .eq("property_id", property.id)
      .gte("date", startOfYear)
      .lte("date", todayIso),
    supabase
      .from("leases")
      .select("unit_id, monthly_rent, tenant_id, status, start_date")
      .eq("status", "active"),
    supabase.from("tenants").select("id, first_name, last_name"),
    supabase
      .from("work_orders")
      .select("unit_id, status")
      .eq("property_id", property.id)
      .in("status", ["open", "assigned", "in_progress"]),
  ]);

  const unitRows = unitsRes.data ?? [];
  const txs = (txRes.data ?? []) as TxRow[];
  const leases = (leasesRes.data ?? []) as LeaseRow[];
  const tenantsById = new Map(
    (tenantsRes.data ?? []).map((t) => [t.id, `${t.first_name} ${t.last_name}`.trim()])
  );
  const wos = (woRes.data ?? []) as WoRow[];

  // Most-recent active lease per unit
  const leaseByUnit = new Map<string, LeaseRow>();
  for (const l of leases) {
    const existing = leaseByUnit.get(l.unit_id);
    if (
      !existing ||
      new Date(l.start_date).getTime() > new Date(existing.start_date).getTime()
    ) {
      leaseByUnit.set(l.unit_id, l);
    }
  }

  // Per-unit aggregates
  const incomeByUnit = new Map<string, number>();
  const expensesByUnit = new Map<string, number>();
  const lastIncomeByUnit = new Map<string, string>();
  const lastExpenseByUnit = new Map<string, string>();
  const currentMonthRentPaidByUnit = new Map<string, number>();
  let commonAreaExpenses = 0;
  let totalIncomeYtd = 0;
  let totalExpensesYtd = 0;

  for (const t of txs) {
    const amt = Number(t.amount);
    if (t.type === "income") {
      totalIncomeYtd += amt;
      if (t.unit_id) {
        incomeByUnit.set(t.unit_id, (incomeByUnit.get(t.unit_id) ?? 0) + amt);
        const prior = lastIncomeByUnit.get(t.unit_id);
        if (!prior || new Date(t.date) > new Date(prior)) {
          lastIncomeByUnit.set(t.unit_id, t.date);
        }
        if (t.category === "rent" && t.date >= firstOfMonth) {
          currentMonthRentPaidByUnit.set(
            t.unit_id,
            (currentMonthRentPaidByUnit.get(t.unit_id) ?? 0) + amt
          );
        }
      }
    } else if (t.type === "expense") {
      totalExpensesYtd += amt;
      if (t.unit_id) {
        expensesByUnit.set(t.unit_id, (expensesByUnit.get(t.unit_id) ?? 0) + amt);
        const prior = lastExpenseByUnit.get(t.unit_id);
        if (!prior || new Date(t.date) > new Date(prior)) {
          lastExpenseByUnit.set(t.unit_id, t.date);
        }
      } else {
        commonAreaExpenses += amt;
      }
    }
  }

  const openWoByUnit = new Map<string, number>();
  for (const w of wos) {
    if (!w.unit_id) continue;
    openWoByUnit.set(w.unit_id, (openWoByUnit.get(w.unit_id) ?? 0) + 1);
  }

  // Annualize the YTD net cash flow using the fraction of the year elapsed.
  const yearStartMs = new Date(startOfYear).getTime();
  const elapsedMs = Math.max(1, Date.now() - yearStartMs);
  const yearFraction = Math.min(1, elapsedMs / (365 * 24 * 60 * 60 * 1000));
  const annualScale = 1 / Math.max(yearFraction, 1 / 12);

  const units: UnitPnlRow[] = unitRows.map((u) => {
    const lease = leaseByUnit.get(u.id);
    const scheduledRent = lease ? Number(lease.monthly_rent) : null;
    const incomeYtd = incomeByUnit.get(u.id) ?? 0;
    const expensesYtd = expensesByUnit.get(u.id) ?? 0;
    const netCashFlowYtd = incomeYtd - expensesYtd;
    const paidThisMonth = currentMonthRentPaidByUnit.get(u.id) ?? 0;

    let rentStatus: UnitPnlRow["rent_status"];
    if (!lease || u.status === "vacant") {
      rentStatus = "vacant";
    } else if (scheduledRent != null && paidThisMonth >= scheduledRent) {
      rentStatus = "paid";
    } else if (paidThisMonth > 0) {
      rentStatus = "partial";
    } else {
      rentStatus = "due";
    }

    const annualizedNoi = netCashFlowYtd * annualScale;
    const annualScheduled = scheduledRent != null ? scheduledRent * 12 : null;
    const netYieldPct =
      annualScheduled && annualScheduled > 0
        ? (annualizedNoi / annualScheduled) * 100
        : null;

    return {
      unit_id: u.id,
      unit_number: u.unit_number,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms != null ? Number(u.bathrooms) : null,
      status: u.status,
      monthly_rent: u.monthly_rent != null ? Number(u.monthly_rent) : null,
      scheduled_rent: scheduledRent,
      tenant_name: lease ? tenantsById.get(lease.tenant_id) ?? null : null,
      rent_status: rentStatus,
      income_ytd: incomeYtd,
      expenses_ytd: expensesYtd,
      net_cash_flow_ytd: netCashFlowYtd,
      net_yield_pct: netYieldPct,
      last_rent_payment_at: lastIncomeByUnit.get(u.id) ?? null,
      last_expense_at: lastExpenseByUnit.get(u.id) ?? null,
      open_work_orders: openWoByUnit.get(u.id) ?? 0,
    };
  });

  return {
    property_id: property.id,
    property_name: property.name,
    as_of: todayIso,
    units,
    totals: {
      income_ytd: totalIncomeYtd,
      expenses_ytd: totalExpensesYtd,
      common_area_expenses_ytd: commonAreaExpenses,
      net_cash_flow_ytd: totalIncomeYtd - totalExpensesYtd,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mortgage breakdown + paydown
// ─────────────────────────────────────────────────────────────────────────────

function scheduledMonthlyPayment(balance: number, annualRatePct: number, years = DEFAULT_AMORT_YEARS) {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return balance / n;
  return (balance * r) / (1 - Math.pow(1 + r, -n));
}

export type MortgageBreakdown = {
  property_value: number | null;
  mortgage_balance: number;
  interest_rate_pct: number;
  amort_years: number;
  scheduled_monthly_payment: number;
  this_month_interest: number;
  this_month_principal: number;
  projected_balance_after_payment: number;
  current_equity: number | null;
  projected_equity_after_payment: number | null;
  current_ltv_pct: number | null;
  projected_ltv_pct: number | null;
};

export async function getMortgageBreakdown(amortYears: number = DEFAULT_AMORT_YEARS):
  Promise<MortgageBreakdown | null>
{
  const supabase = await createServerSupabaseClient();
  const { data: property } = await supabase
    .from("properties")
    .select("current_value, mortgage_balance, interest_rate")
    .limit(1)
    .maybeSingle();
  if (!property) return null;

  const value = property.current_value != null ? Number(property.current_value) : null;
  const balance = property.mortgage_balance != null ? Number(property.mortgage_balance) : 0;
  const rate = property.interest_rate != null ? Number(property.interest_rate) : 0;

  if (balance <= 0 || rate <= 0) {
    return {
      property_value: value,
      mortgage_balance: balance,
      interest_rate_pct: rate,
      amort_years: amortYears,
      scheduled_monthly_payment: 0,
      this_month_interest: 0,
      this_month_principal: 0,
      projected_balance_after_payment: balance,
      current_equity: value != null ? value - balance : null,
      projected_equity_after_payment: value != null ? value - balance : null,
      current_ltv_pct: value && value > 0 ? (balance / value) * 100 : null,
      projected_ltv_pct: value && value > 0 ? (balance / value) * 100 : null,
    };
  }

  const monthlyRate = rate / 100 / 12;
  const pmt = scheduledMonthlyPayment(balance, rate, amortYears);
  const interest = balance * monthlyRate;
  const principal = Math.max(0, pmt - interest);
  const newBalance = Math.max(0, balance - principal);

  return {
    property_value: value,
    mortgage_balance: balance,
    interest_rate_pct: rate,
    amort_years: amortYears,
    scheduled_monthly_payment: pmt,
    this_month_interest: interest,
    this_month_principal: principal,
    projected_balance_after_payment: newBalance,
    current_equity: value != null ? value - balance : null,
    projected_equity_after_payment: value != null ? value - newBalance : null,
    current_ltv_pct: value && value > 0 ? (balance / value) * 100 : null,
    projected_ltv_pct: value && value > 0 ? (newBalance / value) * 100 : null,
  };
}

export type ApplyPaymentResult = {
  success: boolean;
  error?: string;
  before: MortgageBreakdown;
  after: MortgageBreakdown;
};

/**
 * Posts this month's mortgage payment:
 *   - decrements properties.mortgage_balance by the principal portion
 *   - inserts two transactions for the audit trail:
 *       1. expense category=mortgage_interest (the interest portion)
 *       2. expense category=mortgage_principal (the principal portion — also reduces equity-as-expense)
 *   - logs the event to ai_logs
 *
 * If `overrideAmountUsd` is provided, uses that as the actual payment
 * total and computes the principal/interest split from the live
 * interest accrual (so partial payments work).
 */
export async function applyMortgagePayment(
  overrideAmountUsd?: number
): Promise<{ success: boolean; error?: string; breakdown?: MortgageBreakdown; new_equity?: number | null }> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("id, current_value, mortgage_balance, interest_rate")
    .limit(1)
    .maybeSingle();
  if (propErr || !property) {
    return { success: false, error: propErr?.message ?? "No property found" };
  }

  const value = property.current_value != null ? Number(property.current_value) : null;
  const balance = property.mortgage_balance != null ? Number(property.mortgage_balance) : 0;
  const rate = property.interest_rate != null ? Number(property.interest_rate) : 0;

  if (balance <= 0 || rate <= 0) {
    return { success: false, error: "Property has no mortgage balance or interest rate to amortize" };
  }

  const monthlyRate = rate / 100 / 12;
  const scheduled = scheduledMonthlyPayment(balance, rate);
  const payment = overrideAmountUsd && overrideAmountUsd > 0 ? overrideAmountUsd : scheduled;
  const interest = balance * monthlyRate;

  if (payment < interest) {
    return {
      success: false,
      error: `Payment of $${payment.toFixed(2)} is below the $${interest.toFixed(2)} accrued interest — balance would grow.`,
    };
  }
  const principal = Math.max(0, payment - interest);
  const newBalance = Math.max(0, balance - principal);

  const today = new Date().toISOString().split("T")[0];

  const { error: updErr } = await admin
    .from("properties")
    .update({ mortgage_balance: newBalance })
    .eq("id", property.id);
  if (updErr) return { success: false, error: `Balance update failed: ${updErr.message}` };

  const txInserts = [
    {
      property_id: property.id,
      unit_id: null,
      amount: Number(interest.toFixed(2)),
      date: today,
      type: "expense",
      category: "mortgage_interest",
      description: "Mortgage payment — interest portion",
      notes: `Auto-posted (balance ${balance.toFixed(2)} → ${newBalance.toFixed(2)})`,
    },
    {
      property_id: property.id,
      unit_id: null,
      amount: Number(principal.toFixed(2)),
      date: today,
      type: "expense",
      category: "mortgage_principal",
      description: "Mortgage payment — principal portion",
      notes: `Equity gained $${principal.toFixed(2)}`,
    },
  ].filter((t) => t.amount > 0);

  if (txInserts.length > 0) {
    const { error: txErr } = await admin.from("transactions").insert(txInserts);
    if (txErr) console.warn("Failed to log mortgage transactions:", txErr.message);
  }

  try {
    await admin.from("ai_logs").insert({
      agent_name: "ledger-mortgage",
      task_description: "apply_mortgage_payment",
      model_used: "deterministic",
      token_cost: 0,
      status: "succeeded",
      output_data: {
        property_id: property.id,
        payment,
        interest,
        principal,
        balance_before: balance,
        balance_after: newBalance,
        equity_before: value != null ? value - balance : null,
        equity_after: value != null ? value - newBalance : null,
        posted_at: today,
      } as Record<string, unknown>,
    });
  } catch {
    /* swallow */
  }

  revalidatePath("/dashboard");
  revalidatePath("/finance");
  revalidatePath("/equity");

  const after: MortgageBreakdown = {
    property_value: value,
    mortgage_balance: newBalance,
    interest_rate_pct: rate,
    amort_years: DEFAULT_AMORT_YEARS,
    scheduled_monthly_payment: scheduled,
    this_month_interest: interest,
    this_month_principal: principal,
    projected_balance_after_payment: newBalance,
    current_equity: value != null ? value - newBalance : null,
    projected_equity_after_payment: value != null ? value - newBalance : null,
    current_ltv_pct: value && value > 0 ? (newBalance / value) * 100 : null,
    projected_ltv_pct: value && value > 0 ? (newBalance / value) * 100 : null,
  };

  return {
    success: true,
    breakdown: after,
    new_equity: value != null ? value - newBalance : null,
  };
}
