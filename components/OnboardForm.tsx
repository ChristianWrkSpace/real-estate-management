"use client";

import { useState, useTransition } from "react";
import { acceptLeaseAndOnboard, type OnboardingContext } from "@/app/actions/onboarding";

const fmtUsd = (n: number | null) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });

export default function OnboardForm({
  token,
  context,
}: {
  token: string;
  context: OnboardingContext;
}) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    signatureName: `${context.tenant.first_name} ${context.tenant.last_name}`.trim(),
    verifiedEmail: context.tenant.email ?? "",
    verifiedPhone: context.tenant.phone ?? "",
    acceptedTerms: false,
  });
  const [done, setDone] = useState<{
    paymentLinkUrl: string | null;
    documentUrl: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await acceptLeaseAndOnboard({
        token,
        signatureName: form.signatureName,
        verifiedEmail: form.verifiedEmail,
        verifiedPhone: form.verifiedPhone,
        acceptedTerms: form.acceptedTerms,
      });
      if (r.success) {
        setDone({
          paymentLinkUrl: r.payment_link_url ?? null,
          documentUrl: r.document_url ?? null,
        });
      } else {
        setError(r.error || "Failed to accept lease");
      }
    });
  };

  if (done) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10 text-3xl text-emerald-300">
          ✓
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Welcome home.</h2>
          <p className="mt-1 text-sm text-white/60">
            Your lease for <strong className="text-white">Unit {context.unit.unit_number}</strong> at{" "}
            {context.property.name} is now active.
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          {done.paymentLinkUrl ? (
            <a
              href={done.paymentLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-center font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-700 hover:to-indigo-700"
            >
              Pay first month's rent ({fmtUsd(context.monthly_rent)})
            </a>
          ) : (
            <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Your landlord will follow up with payment details shortly.
            </p>
          )}

          {done.documentUrl && (
            <a
              href={done.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-xl border border-white/15 bg-white/5 px-6 py-2.5 text-center text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              View your signed lease (PDF) ↗
            </a>
          )}
        </div>

        <p className="pt-2 text-xs text-white/40">
          A copy of everything was sent to {form.verifiedEmail}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Full legal name (digital signature)">
        <input
          required
          value={form.signatureName}
          onChange={(e) => setForm({ ...form, signatureName: e.target.value })}
          placeholder="As it should appear on the lease"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email">
          <input
            type="email"
            required
            value={form.verifiedEmail}
            onChange={(e) => setForm({ ...form, verifiedEmail: e.target.value })}
            placeholder="you@example.com"
            className={inputClass}
          />
        </Field>
        <Field label="Phone (optional)">
          <input
            type="tel"
            value={form.verifiedPhone}
            onChange={(e) => setForm({ ...form, verifiedPhone: e.target.value })}
            placeholder="(956) 555-0142"
            className={inputClass}
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
        <input
          type="checkbox"
          checked={form.acceptedTerms}
          onChange={(e) => setForm({ ...form, acceptedTerms: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-blue-500"
        />
        <span className="text-sm text-white/80">
          I have reviewed the lease above and agree to be bound by it. I understand that
          clicking <strong>Accept &amp; Activate Lease</strong> constitutes a legally
          binding electronic signature under the federal E-SIGN Act and Texas UETA.
        </span>
      </label>

      {error && (
        <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          ⚠ {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !form.acceptedTerms}
        className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:from-emerald-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Activating your lease…" : "Accept & Activate Lease"}
      </button>

      <p className="text-center text-[10px] text-white/40">
        Your IP and timestamp will be recorded with your signature.
      </p>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 transition focus:border-blue-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
        {label}
      </span>
      {children}
    </label>
  );
}
