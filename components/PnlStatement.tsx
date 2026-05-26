import type { PnlBundle } from "@/app/actions/pnl";

const fmtUsd = (n: number | null | undefined, frac = 0) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: frac,
      });

const fmtPct = (n: number | null | undefined, frac = 1) =>
  n == null ? "—" : `${n.toFixed(frac)}%`;

const fmtRatio = (n: number | null | undefined, frac = 2) =>
  n == null ? "—" : n.toFixed(frac);

export default function PnlStatement({ pnl }: { pnl: PnlBundle }) {
  const collectionGap = pnl.scheduled_rent_period - pnl.gross_rent;

  return (
    <div className="space-y-6">
      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Gross Income" value={fmtUsd(pnl.income_total)} accent="emerald" />
        <Kpi label="Operating Expenses" value={fmtUsd(pnl.opex_total)} accent="rose" />
        <Kpi
          label="NOI"
          value={`${pnl.noi_period >= 0 ? "+" : ""}${fmtUsd(pnl.noi_period)}`}
          accent={pnl.noi_period >= 0 ? "emerald" : "rose"}
          mono
        />
        <Kpi
          label="Pre-Tax Cash Flow"
          value={`${pnl.pre_tax_cash_flow_period >= 0 ? "+" : ""}${fmtUsd(pnl.pre_tax_cash_flow_period)}`}
          accent={pnl.pre_tax_cash_flow_period >= 0 ? "blue" : "rose"}
          mono
        />
      </div>

      {/* The Statement */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/80 shadow-xl">
        <header className="border-b border-zinc-800 bg-zinc-900 px-5 py-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold tracking-tight text-zinc-100">
              Profit &amp; Loss Statement
            </h3>
            <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              {pnl.period_label} · {pnl.months_in_period.toFixed(1)} mo · {pnl.property_name}
            </p>
          </div>
        </header>

        <div className="p-5">
          {/* Income */}
          <Section title="Revenue">
            {pnl.income_lines.map((line) => (
              <Row
                key={line.category}
                label={line.label}
                count={line.count}
                amount={line.amount}
                positive
              />
            ))}
            {pnl.income_lines.length === 0 && (
              <Row label="No revenue logged this period" amount={0} muted />
            )}
            <TotalRow label="Total Gross Income" amount={pnl.income_total} positive />
            {pnl.scheduled_rent_period > 0 && (
              <SubInfo>
                Scheduled rent for period:{" "}
                <span className="font-mono">{fmtUsd(pnl.scheduled_rent_period)}</span> · Collection
                rate: <span className="font-mono">{fmtPct(pnl.collection_rate_pct)}</span>
                {collectionGap > 0 && (
                  <span className="ml-2 text-rose-300">
                    (gap {fmtUsd(collectionGap)} uncollected)
                  </span>
                )}
              </SubInfo>
            )}
          </Section>

          {/* Operating expenses */}
          <Section title="Operating Expenses">
            {pnl.opex_lines.map((line) => (
              <Row
                key={line.category}
                label={line.label}
                count={line.count}
                amount={line.amount}
              />
            ))}
            {pnl.uncategorized_opex_total > 0 && (
              <Row
                label="Other / Uncategorized"
                amount={pnl.uncategorized_opex_total}
                muted
              />
            )}
            {pnl.opex_lines.length === 0 && pnl.uncategorized_opex_total === 0 && (
              <Row label="No operating expenses logged" amount={0} muted />
            )}
            <TotalRow label="Total Operating Expenses" amount={pnl.opex_total} />
          </Section>

          {/* NOI line */}
          <NoiRow
            label="Net Operating Income (NOI)"
            amount={pnl.noi_period}
            sub={`Annualized: ${fmtUsd(pnl.noi_annualized)} · OpEx ratio: ${fmtPct(pnl.operating_expense_ratio_pct)}`}
          />

          {/* Debt service */}
          <Section title="Debt Service (below NOI)">
            <Row
              label="Mortgage Interest"
              amount={pnl.mortgage_interest_period}
              note="tax-deductible"
            />
            <Row
              label="Principal Pay-Down"
              amount={pnl.mortgage_principal_period}
              note="equity build (not expensed)"
              equityBuild
            />
            <TotalRow label="Total Debt Service" amount={pnl.total_debt_service_period} />
          </Section>

          {/* Cash flow line */}
          <NoiRow
            label="Pre-Tax Cash Flow"
            amount={pnl.pre_tax_cash_flow_period}
            sub={`Annualized: ${fmtUsd(pnl.pre_tax_cash_flow_annualized)}`}
            accent="blue"
          />

          {/* Equity build summary */}
          <Section title="Equity Movement">
            <Row
              label="Principal pay-down logged this period"
              amount={pnl.equity_built_period}
              equityBuild
            />
            <Row
              label="Current equity (value − balance)"
              amount={pnl.equity ?? 0}
              equityBuild
            />
          </Section>
        </div>
      </div>

      {/* Ratios + reserves grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RatioPanel
          title="Performance Ratios"
          items={[
            { label: "Cap Rate", value: fmtPct(pnl.cap_rate_pct, 2), hint: "annualized NOI / value" },
            { label: "Cash-on-Cash", value: fmtPct(pnl.cash_on_cash_pct, 2), hint: "annualized cash flow / equity" },
            { label: "DSCR", value: fmtRatio(pnl.dscr), hint: "NOI / annual debt service (1.0+ = breakeven)" },
            { label: "GRM", value: fmtRatio(pnl.grm), hint: "value / annual gross rent" },
            { label: "OpEx Ratio", value: fmtPct(pnl.operating_expense_ratio_pct, 1), hint: "lower = leaner" },
            { label: "Collection Rate", value: fmtPct(pnl.collection_rate_pct, 1), hint: "collected / scheduled" },
          ]}
        />
        <RatioPanel
          title="Reserve Targets (recommended)"
          items={[
            { label: "CapEx reserve", value: fmtUsd(pnl.recommended_capex_reserve), hint: "10% of annualized income" },
            { label: "Tax reserve", value: fmtUsd(pnl.recommended_tax_reserve), hint: "30% of annualized cash flow" },
            { label: "Emergency reserve", value: fmtUsd(pnl.emergency_reserve_target), hint: "6 months of OpEx" },
            { label: "Property value", value: fmtUsd(pnl.property_value), hint: "live" },
            { label: "Mortgage balance", value: fmtUsd(pnl.mortgage_balance, 2), hint: "live" },
            { label: "Equity", value: fmtUsd(pnl.equity), hint: "value − balance" },
          ]}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  accent,
  mono = false,
}: {
  label: string;
  value: string;
  accent: "emerald" | "rose" | "blue" | "indigo";
  mono?: boolean;
}) {
  const cls =
    accent === "emerald"
      ? "text-emerald-400"
      : accent === "rose"
        ? "text-rose-400"
        : accent === "blue"
          ? "text-blue-400"
          : "text-indigo-400";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-xl">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold tracking-tight ${cls} ${mono ? "font-mono" : "font-mono"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <h4 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {title}
      </h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  amount,
  count,
  positive = false,
  muted = false,
  equityBuild = false,
  note,
}: {
  label: string;
  amount: number;
  count?: number;
  positive?: boolean;
  muted?: boolean;
  equityBuild?: boolean;
  note?: string;
}) {
  const valCls = muted
    ? "text-zinc-500"
    : equityBuild
      ? "text-blue-300"
      : positive
        ? "text-emerald-300"
        : "text-zinc-200";
  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <span className="flex items-baseline gap-2 text-zinc-300">
        <span className="text-zinc-500">·</span>
        <span>{label}</span>
        {count != null && count > 0 && (
          <span className="text-[10px] text-zinc-600">×{count}</span>
        )}
        {note && (
          <span className="text-[10px] italic text-zinc-500">— {note}</span>
        )}
      </span>
      <span className={`font-mono ${valCls}`}>
        {positive ? "+" : equityBuild ? "" : amount === 0 ? "" : "−"}
        {fmtUsd(Math.abs(amount), 2)}
      </span>
    </div>
  );
}

function TotalRow({
  label,
  amount,
  positive = false,
}: {
  label: string;
  amount: number;
  positive?: boolean;
}) {
  return (
    <div className="mt-1.5 flex items-baseline justify-between border-t border-zinc-800 pt-2 text-sm font-semibold">
      <span className="text-zinc-100">{label}</span>
      <span
        className={`font-mono ${
          positive ? "text-emerald-400" : "text-zinc-100"
        }`}
      >
        {positive ? "+" : ""}
        {fmtUsd(amount, 2)}
      </span>
    </div>
  );
}

function SubInfo({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-[11px] text-zinc-500">{children}</p>
  );
}

function NoiRow({
  label,
  amount,
  sub,
  accent = "emerald",
}: {
  label: string;
  amount: number;
  sub: string;
  accent?: "emerald" | "blue";
}) {
  const valCls =
    accent === "emerald" ? "text-emerald-400" : "text-blue-400";
  return (
    <div
      className={`my-4 rounded-lg border bg-zinc-950 px-4 py-3 ${
        accent === "emerald"
          ? "border-emerald-500/40 shadow-[0_0_28px_rgba(16,185,129,0.10)]"
          : "border-blue-500/40 shadow-[0_0_28px_rgba(59,130,246,0.10)]"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">
          {label}
        </span>
        <span className={`font-mono text-xl font-semibold ${valCls}`}>
          {amount >= 0 ? "+" : ""}
          {fmtUsd(amount, 2)}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">{sub}</p>
    </div>
  );
}

function RatioPanel({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string; hint?: string }[];
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-xl">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li
            key={i.label}
            className="flex items-baseline justify-between border-b border-zinc-800/50 pb-2 last:border-0"
          >
            <span>
              <p className="text-sm text-zinc-200">{i.label}</p>
              {i.hint && (
                <p className="text-[10px] text-zinc-500">{i.hint}</p>
              )}
            </span>
            <span className="font-mono text-sm font-semibold text-zinc-100">
              {i.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
