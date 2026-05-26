/**
 * Ledger-Capital — capital-strategy intelligence agent.
 *
 * Computes everything deterministically first (LTV, equity, cash-on-cash,
 * refi savings) so the dashboard always has numbers. The Opus-tier
 * narrative is an optional layer on top — if the AI call fails or is
 * disabled, the deterministic recommendation is still returned.
 */

import { runFrontierAgent } from "@/lib/ai/orchestrator";

export type CapitalInput = {
  propertyName: string;
  currentValue: number | null;
  mortgageBalance: number | null;
  interestRatePct: number | null;
  purchasePrice: number | null;
  purchaseDate: string | null; // YYYY-MM-DD
  noiYtd: number;
  monthsElapsedThisYear: number;
  /** Optional override for market 30-yr fixed rate. Defaults to MARKET_REFI_RATE_PCT env or 7.0. */
  marketRefiRatePct?: number;
};

export type CapitalRecommendation =
  | "refi_rate"        // current rate > market by ≥1.0% → swap to lower rate
  | "cash_out_refi"    // equity > 35% of value → extract trapped capital
  | "hold"             // current structure is optimal
  | "deleverage"       // LTV > 80% → pay down to reduce risk
  | "insufficient_data";

export type CapitalAnalysis = {
  // Core math
  equity: number | null;
  ltv_pct: number | null;
  equity_pct: number | null;          // 1 - ltv
  market_refi_rate_pct: number;
  rate_delta_pct: number | null;      // current - market (positive = overpaying)
  annualized_noi: number;
  cash_on_cash_pct: number | null;    // NOI / equity
  yield_on_value_pct: number | null;  // NOI / current_value (cap rate proxy)
  years_held: number | null;

  // Trapped-equity & refi math
  cash_out_amount_at_75ltv: number | null;
  monthly_pmt_current: number | null;
  monthly_pmt_at_market: number | null;
  monthly_savings_at_market: number | null;
  annual_savings_at_market: number | null;
  break_even_months_at_market: number | null; // assumes $5K closing costs

  // Headline
  recommendation: CapitalRecommendation;
  headline: string;
  risk_flags: string[];

  // Optional AI layer
  narrative: string | null;
  narrative_model: string | null;
  narrative_cost_usd: number;

  generated_at: string;
};

const REFI_RATE_DELTA_TRIGGER_PCT = 1.0;
const TARGET_LTV_FOR_CASHOUT = 0.75;
const HIGH_RISK_LTV = 0.80;
const ESTIMATED_CLOSING_COSTS_USD = 5_000;
const DEFAULT_AMORT_YEARS = 30;

function pmtMonthly(principal: number, annualRatePct: number, years = DEFAULT_AMORT_YEARS): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

function yearsBetween(fromIso: string | null, to: Date = new Date()): number | null {
  if (!fromIso) return null;
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return null;
  return (to.getTime() - t) / (1000 * 60 * 60 * 24 * 365.25);
}

function pickRecommendation(args: {
  ltv: number | null;
  rateDelta: number | null;
  equity: number | null;
  cashOut: number | null;
}): { rec: CapitalRecommendation; headline: string } {
  if (args.ltv == null || args.equity == null) {
    return { rec: "insufficient_data", headline: "Set property value + mortgage balance to unlock capital analysis." };
  }
  if (args.ltv > HIGH_RISK_LTV) {
    return {
      rec: "deleverage",
      headline: `LTV ${(args.ltv * 100).toFixed(1)}% exceeds the 80% safety line — prioritize principal paydown over cash-out.`,
    };
  }
  if (args.rateDelta != null && args.rateDelta >= REFI_RATE_DELTA_TRIGGER_PCT) {
    return {
      rec: "refi_rate",
      headline: `Current rate is ${args.rateDelta.toFixed(2)}% above market — rate-and-term refi pays for itself quickly.`,
    };
  }
  if (args.cashOut != null && args.cashOut >= 20_000) {
    return {
      rec: "cash_out_refi",
      headline: `~$${Math.round(args.cashOut / 1_000)}K of trapped equity is extractable at 75% LTV — redeploy or hold.`,
    };
  }
  return {
    rec: "hold",
    headline: "Capital structure is balanced — no refi action recommended right now.",
  };
}

const CAPITAL_SYSTEM = `You are Ledger-Capital, the refinance strategist for a single small-property portfolio.
Style: Jack Dorsey — declarative, terse, no headers, no bullets, ≤90 words, one paragraph.
You are given pre-computed numbers. State the bottom line first (refi recommended? cash-out? hold?).
Reference the exact numbers (LTV, rate delta, cash-out at 75% LTV, monthly savings, break-even months).
End with one concrete next step.
Return JSON ONLY (no fences) with shape { "narrative": string, "risk_flags": string[] }.`;

export async function runCapitalAnalysis(
  input: CapitalInput,
  opts: { includeNarrative?: boolean } = {}
): Promise<CapitalAnalysis> {
  const market =
    input.marketRefiRatePct ??
    (Number(process.env.MARKET_REFI_RATE_PCT) || 7.0);

  const value = input.currentValue;
  const mortgage = input.mortgageBalance;
  const equity = value != null && mortgage != null ? value - mortgage : null;
  const ltv = value && value > 0 && mortgage != null ? mortgage / value : null;
  const equityPct = ltv != null ? 1 - ltv : null;

  const yearFraction = Math.max(input.monthsElapsedThisYear / 12, 1 / 12);
  const annualizedNoi = input.noiYtd / yearFraction;

  const coc = equity && equity > 0 ? (annualizedNoi / equity) * 100 : null;
  const yieldOnValue = value && value > 0 ? (annualizedNoi / value) * 100 : null;

  const cashOutAtTarget =
    value != null && mortgage != null
      ? Math.max(0, value * TARGET_LTV_FOR_CASHOUT - mortgage)
      : null;

  let pmtCurrent: number | null = null;
  let pmtMarket: number | null = null;
  let monthlySavings: number | null = null;
  let annualSavings: number | null = null;
  let breakEven: number | null = null;

  if (mortgage && mortgage > 0 && input.interestRatePct && input.interestRatePct > 0) {
    pmtCurrent = pmtMonthly(mortgage, input.interestRatePct);
    pmtMarket = pmtMonthly(mortgage, market);
    monthlySavings = pmtCurrent - pmtMarket;
    annualSavings = monthlySavings * 12;
    breakEven =
      monthlySavings > 0
        ? ESTIMATED_CLOSING_COSTS_USD / monthlySavings
        : null;
  }

  const rateDelta =
    input.interestRatePct != null && input.interestRatePct > 0
      ? input.interestRatePct - market
      : null;

  const { rec, headline } = pickRecommendation({
    ltv,
    rateDelta,
    equity,
    cashOut: cashOutAtTarget,
  });

  const risk_flags: string[] = [];
  if (ltv != null && ltv > HIGH_RISK_LTV)
    risk_flags.push(`LTV ${(ltv * 100).toFixed(1)}% exceeds the 80% safety line.`);
  if (rateDelta != null && rateDelta >= REFI_RATE_DELTA_TRIGGER_PCT)
    risk_flags.push(`Paying ${rateDelta.toFixed(2)}% above current market rates.`);
  if (coc != null && coc < 4)
    risk_flags.push(`Cash-on-cash yield ${coc.toFixed(1)}% — capital may be under-deployed.`);
  if (yieldOnValue != null && yieldOnValue < 4)
    risk_flags.push(`Cap rate proxy ${yieldOnValue.toFixed(1)}% — below typical buy-and-hold target.`);

  const base: CapitalAnalysis = {
    equity,
    ltv_pct: ltv != null ? ltv * 100 : null,
    equity_pct: equityPct != null ? equityPct * 100 : null,
    market_refi_rate_pct: market,
    rate_delta_pct: rateDelta,
    annualized_noi: annualizedNoi,
    cash_on_cash_pct: coc,
    yield_on_value_pct: yieldOnValue,
    years_held: yearsBetween(input.purchaseDate),
    cash_out_amount_at_75ltv: cashOutAtTarget,
    monthly_pmt_current: pmtCurrent,
    monthly_pmt_at_market: pmtMarket,
    monthly_savings_at_market: monthlySavings,
    annual_savings_at_market: annualSavings,
    break_even_months_at_market: breakEven,
    recommendation: rec,
    headline,
    risk_flags,
    narrative: null,
    narrative_model: null,
    narrative_cost_usd: 0,
    generated_at: new Date().toISOString(),
  };

  if (!opts.includeNarrative) return base;

  // Optional AI narrative — best-effort, never blocks the deterministic output
  try {
    const result = await runFrontierAgent<{ narrative: string; risk_flags: string[] }>({
      agent: "ledger-capital",
      task: "capital_strategy_narrative",
      systemPrompt: CAPITAL_SYSTEM,
      userPrompt: `Pre-computed metrics for ${input.propertyName}:\n\n${JSON.stringify(
        {
          equity: base.equity,
          ltv_pct: base.ltv_pct,
          market_refi_rate_pct: base.market_refi_rate_pct,
          current_rate_pct: input.interestRatePct,
          rate_delta_pct: base.rate_delta_pct,
          annualized_noi: base.annualized_noi,
          cash_on_cash_pct: base.cash_on_cash_pct,
          yield_on_value_pct: base.yield_on_value_pct,
          cash_out_at_75ltv: base.cash_out_amount_at_75ltv,
          monthly_savings_at_market: base.monthly_savings_at_market,
          annual_savings_at_market: base.annual_savings_at_market,
          break_even_months: base.break_even_months_at_market,
          recommendation: base.recommendation,
        },
        null,
        2
      )}`,
      maxTokens: 400,
      storeRaw: true,
    });

    if (result.parsed) {
      base.narrative = result.parsed.narrative;
      base.narrative_model = result.model;
      base.narrative_cost_usd = result.costUsd;
      if (Array.isArray(result.parsed.risk_flags)) {
        for (const f of result.parsed.risk_flags) {
          if (typeof f === "string" && !base.risk_flags.includes(f)) {
            base.risk_flags.push(f);
          }
        }
      }
    } else if (result.error) {
      base.risk_flags.push(`AI narrative unavailable: ${result.error.slice(0, 120)}`);
    }
  } catch (err) {
    base.risk_flags.push(
      `AI narrative threw: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return base;
}
