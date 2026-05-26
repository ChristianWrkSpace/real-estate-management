import { getOnboardingContext } from "@/app/actions/onboarding";
import OnboardForm from "@/components/OnboardForm";

export const dynamic = "force-dynamic";

const fmtUsd = (n: number | null) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });

export default async function OnboardPage({
  params,
}: {
  params: Promise<{ lease_id: string }>;
}) {
  // The dynamic segment is actually the onboarding token (random, single-use).
  const { lease_id: token } = await params;
  const context = await getOnboardingContext(token);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950/40 to-slate-900 px-4 py-12 text-white">
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xl">
            🏠
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {context ? "Sign your lease" : "Invalid onboarding link"}
          </h1>
          {context && (
            <p className="mt-2 text-sm text-white/60">
              Welcome to {context.property.name} · Unit {context.unit.unit_number}
            </p>
          )}
        </div>

        {!context && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-xl">
            <p className="text-sm text-white/70">
              This onboarding link is invalid, has already been used, or has expired.
              Please contact your landlord for a fresh link.
            </p>
          </div>
        )}

        {context && context.signed_at && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-8 text-center backdrop-blur-xl">
            <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10 text-2xl text-emerald-300">
              ✓
            </div>
            <h2 className="text-xl font-semibold">This lease is already active.</h2>
            <p className="mt-1 text-sm text-white/60">
              Signed on {new Date(context.signed_at).toLocaleDateString()}.
            </p>
            <p className="mt-4 text-xs text-white/40">
              Need to make a payment? Check your inbox for the rent portal link, or
              contact your landlord.
            </p>
          </div>
        )}

        {context && !context.signed_at && (
          <>
            {/* Lease summary */}
            <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-blue-300/80">
                Lease summary
              </h2>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Row label="Property" value={context.property.name} />
                <Row
                  label="Address"
                  value={`${context.property.address}, ${context.property.city}, ${context.property.state} ${context.property.zip}`}
                />
                <Row
                  label="Unit"
                  value={`#${context.unit.unit_number}${
                    context.unit.bedrooms ? ` · ${context.unit.bedrooms}BR` : ""
                  }${context.unit.bathrooms ? `/${context.unit.bathrooms}BA` : ""}`}
                />
                <Row label="Term" value={context.lease_type} />
                <Row label="Start date" value={context.start_date} />
                <Row label="End date" value={context.end_date ?? "Month-to-month"} />
                <Row label="Monthly rent" value={fmtUsd(context.monthly_rent)} emphasis />
                <Row label="Security deposit" value={fmtUsd(context.security_deposit)} />
                <Row label="Landlord" value={context.property.owner_entity ?? "Owner"} />
                <Row
                  label="Tenant of record"
                  value={`${context.tenant.first_name} ${context.tenant.last_name}`.trim()}
                />
              </dl>
            </div>

            {/* Terms preview */}
            <details className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl">
              <summary className="cursor-pointer text-sm font-semibold text-white/80 hover:text-white">
                Read the full lease terms ▾
              </summary>
              <div className="mt-4 space-y-3 text-xs leading-relaxed text-white/70">
                <p>
                  <strong className="text-white/90">1. Premises.</strong> Landlord rents to
                  Tenant Unit {context.unit.unit_number} at the above address (the
                  "Premises").
                </p>
                <p>
                  <strong className="text-white/90">2. Term.</strong>{" "}
                  {context.end_date
                    ? `Fixed term from ${context.start_date} through ${context.end_date}.`
                    : `Month-to-month tenancy beginning ${context.start_date}.`}
                </p>
                <p>
                  <strong className="text-white/90">3. Rent.</strong> Tenant agrees to pay{" "}
                  {fmtUsd(context.monthly_rent)} on the first of each month via the secure
                  Stripe payment portal provided after acceptance.
                </p>
                {context.security_deposit && context.security_deposit > 0 && (
                  <p>
                    <strong className="text-white/90">4. Security deposit.</strong> A
                    deposit of {fmtUsd(context.security_deposit)} is held by Landlord,
                    refundable per Texas Property Code §92.103.
                  </p>
                )}
                <p>
                  <strong className="text-white/90">5. Maintenance.</strong> Landlord
                  maintains habitability per Texas Property Code §92.052. Tenant reports
                  defects via the work-order portal.
                </p>
                <p>
                  <strong className="text-white/90">6. Electronic signature.</strong>{" "}
                  Clicking ACCEPT below constitutes a legally binding electronic signature
                  under the federal E-SIGN Act and Texas UETA.
                </p>
              </div>
            </details>

            {/* Acceptance form */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
              <h2 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300/80">
                Digital acceptance
              </h2>
              <OnboardForm token={token} context={context} />
            </div>
          </>
        )}

        <p className="mt-8 text-center text-[10px] text-white/30">
          PropMan OS · Secure tenant onboarding · Stripe & Supabase
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-2 last:border-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
        {label}
      </dt>
      <dd
        className={`text-right ${
          emphasis ? "text-base font-bold text-emerald-300" : "text-white/90"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
