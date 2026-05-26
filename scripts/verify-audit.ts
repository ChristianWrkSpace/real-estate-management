/**
 * Verifies Sprint 3+4 end-to-end:
 *   1. probes the live schema
 *   2. runs the Argus financial audit via the same code path the
 *      dashboard uses
 *   3. streams the narrative + numbers to stdout
 *
 * Bypasses Next's server-only cookie checks by calling the
 * orchestrator directly with an admin client.
 *
 * NOTE: dotenv must run BEFORE any module that reads env vars at
 * import time. ESM hoists static imports, so we load env first and
 * then dynamic-import the orchestrator + supabase client.
 */

import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY missing from .env.local — aborting.");
  process.exit(1);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Supabase env vars missing — aborting.");
  process.exit(1);
}

const fmtUsd = (n: number | null) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const fmtPct = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)}%`);

const ARGUS_SYSTEM = `You are Argus, the financial audit agent for PropMan OS — a small-property P&L system.
Style: Jack Dorsey — declarative, terse, no filler, no headers, no bullet lists.
Output one paragraph (<=120 words). State the bottom line first. Mention NOI and Cap Rate in numbers.
Call out at most TWO risks or anomalies if any. End with one concrete recommendation.
Return JSON ONLY (no fences, no preamble) with shape:
{ "narrative": string, "flags": string[] }`;

async function main() {
  // Dynamic import so the env vars above are set before these modules
  // initialize their Supabase / Anthropic clients.
  const { createClient } = await import("@supabase/supabase-js");
  const { runFrontierAgent } = await import("../lib/ai/orchestrator");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("🔍 Verifying live schema + running Argus audit\n");

  const { data: properties } = await supabase
    .from("properties")
    .select("id, name, current_value, mortgage_balance, purchase_price, interest_rate")
    .limit(1);
  const property = properties?.[0];
  if (!property) {
    console.error("❌ No property found");
    process.exit(1);
  }

  const startOfYear = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().split("T")[0];

  const { data: txs } = await supabase
    .from("transactions")
    .select("amount, date, type, category, description")
    .eq("property_id", property.id)
    .gte("date", startOfYear)
    .lte("date", today);

  const transactions = txs ?? [];
  console.log(`📊 Loaded ${transactions.length} transactions for ${property.name}`);

  const income = transactions
    .filter((t: { type: string }) => t.type === "income")
    .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);
  const expenses = transactions
    .filter((t: { type: string }) => t.type === "expense")
    .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);
  const noi = income - expenses;

  const yearStart = new Date(startOfYear).getTime();
  const elapsed = Math.max(1, Date.now() - yearStart);
  const yearFraction = Math.min(1, elapsed / (365 * 24 * 3600 * 1000));
  const annualizedNoi = noi / Math.max(yearFraction, 1 / 12);

  const value = property.current_value ? Number(property.current_value) : null;
  const mortgage = property.mortgage_balance ? Number(property.mortgage_balance) : null;
  const purchasePrice = property.purchase_price ? Number(property.purchase_price) : null;
  const equity = value != null && mortgage != null ? value - mortgage : null;
  const capRatePct = value && value > 0 ? (annualizedNoi / value) * 100 : null;
  const cashInvested = purchasePrice && mortgage ? purchasePrice - mortgage : equity;
  const cocPct = cashInvested && cashInvested > 0 ? (annualizedNoi / cashInvested) * 100 : null;
  const monthsElapsed = Math.max(1, Math.round(yearFraction * 12));
  const monthlyAvgRent =
    transactions
      .filter((t: { category: string }) => t.category === "rent")
      .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0) / monthsElapsed;

  console.log("\n── Computed metrics ──");
  console.log(`  Property value:   ${fmtUsd(value)}`);
  console.log(`  Mortgage:         ${fmtUsd(mortgage)}`);
  console.log(`  Equity:           ${fmtUsd(equity)}`);
  console.log(`  Income YTD:       ${fmtUsd(income)}`);
  console.log(`  Expenses YTD:     ${fmtUsd(expenses)}`);
  console.log(`  NOI YTD:          ${fmtUsd(noi)}`);
  console.log(`  Annualized NOI:   ${fmtUsd(annualizedNoi)}`);
  console.log(`  Cap Rate:         ${fmtPct(capRatePct)}`);
  console.log(`  Cash-on-Cash:     ${fmtPct(cocPct)}`);
  console.log(`  Monthly Rent run: ${fmtUsd(monthlyAvgRent)}`);

  const summaryForModel = {
    property: property.name,
    as_of: today,
    ytd_income: income,
    ytd_expenses: expenses,
    ytd_noi: noi,
    annualized_noi: annualizedNoi,
    current_value: value,
    mortgage_balance: mortgage,
    equity,
    cap_rate_pct: capRatePct,
    cash_on_cash_pct: cocPct,
    monthly_avg_rent: monthlyAvgRent,
    transaction_count: transactions.length,
    categories: transactions.reduce<Record<string, number>>(
      (acc: Record<string, number>, t: { type: string; category: string; amount: number }) => {
        const key = `${t.type}:${t.category}`;
        acc[key] = (acc[key] ?? 0) + Number(t.amount);
        return acc;
      },
      {}
    ),
  };

  console.log("\n🤖 Calling Argus (frontier tier)…\n");

  const result = await runFrontierAgent<{ narrative: string; flags: string[] }>({
    agent: "argus",
    task: "verify_financial_audit",
    systemPrompt: ARGUS_SYSTEM,
    userPrompt: `Here are the YTD financials. Produce the JSON.\n\n${JSON.stringify(
      summaryForModel,
      null,
      2
    )}`,
    maxTokens: 600,
    storeRaw: true,
  });

  console.log("─".repeat(70));
  console.log(`Model:  ${result.model}`);
  console.log(
    `Cost:   $${result.costUsd.toFixed(6)} (${result.tokensIn} in / ${result.tokensOut} out)`
  );
  console.log(`Status: ${result.success ? "✅ success" : "❌ failed"}`);
  if (result.logId) console.log(`Log ID: ${result.logId}`);
  if (result.error) console.log(`Error:  ${result.error}`);
  console.log("─".repeat(70));

  if (result.parsed) {
    console.log("\n📝 NARRATIVE\n");
    console.log(result.parsed.narrative);
    if (result.parsed.flags?.length) {
      console.log("\n⚠ FLAGS");
      for (const f of result.parsed.flags) console.log(`  · ${f}`);
    }
  } else if (result.content) {
    console.log("\n(Raw output — JSON parse failed)\n");
    console.log(result.content);
  }

  console.log("\n✨ Audit complete.");
  process.exit(result.success ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
