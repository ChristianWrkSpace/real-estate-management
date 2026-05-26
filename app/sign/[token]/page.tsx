import { getSigningContext } from "@/app/actions/signing";
import SignForm from "@/components/SignForm";

export const dynamic = "force-dynamic";

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await getSigningContext(token);

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 shadow-lg shadow-emerald-500/20">
            <span className="text-xl">📝</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {ctx ? "Sign your document" : "Invalid signing link"}
          </h1>
          {ctx && (
            <p className="mt-2 text-sm text-zinc-400">
              {ctx.template_label} · {ctx.property_name}
            </p>
          )}
        </header>

        {!ctx && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-8 text-center backdrop-blur-xl">
            <p className="text-sm text-zinc-300">
              This signing link is invalid, has been used, or expired. Ask the
              landlord to send you a fresh one.
            </p>
          </div>
        )}

        {ctx && (
          <>
            <section className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.04] p-5 backdrop-blur-xl">
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                Document details
              </h2>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Row label="Document" value={ctx.template_label} />
                <Row label="Property" value={ctx.property_name} />
                <Row label="Address" value={ctx.property_full_address} />
                <Row label="Recipient" value={ctx.tenant_name} />
                {ctx.tenant_email && <Row label="Email" value={ctx.tenant_email} />}
                <Row
                  label="Link expires"
                  value={new Date(ctx.expires_at).toLocaleDateString()}
                />
              </dl>
            </section>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6 backdrop-blur-xl">
              <SignForm
                token={token}
                tenantName={ctx.tenant_name}
                templateLabel={ctx.template_label}
                requiredFields={ctx.required_fields}
                prefilled={ctx.prefilled}
              />
            </div>
          </>
        )}

        <p className="mt-8 text-center text-[10px] text-zinc-600">
          PropMan OS · Secure e-signature · Texas UETA / federal E-SIGN compliant
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/[0.04] pb-2 last:border-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className="text-right text-zinc-200">{value}</dd>
    </div>
  );
}
