"use client";

import { useState, useTransition } from "react";
import { submitSignedContract } from "@/app/actions/signing";

const fieldLabel = (token: string) =>
  token
    .replace(/^\[|\]$/g, "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function SignForm({
  token,
  tenantName,
  templateLabel,
  requiredFields,
  prefilled,
}: {
  token: string;
  tenantName: string;
  templateLabel: string;
  requiredFields: string[];
  prefilled: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    Object.fromEntries(requiredFields.map((k) => [k, ""]))
  );
  const [signatureName, setSignatureName] = useState(tenantName);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ url: string | null } | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await submitSignedContract({
        token,
        fieldValues,
        signatureName,
        acceptedTerms,
      });
      if (r.success) {
        setDone({ url: r.download_url ?? null });
      } else {
        setError(r.error ?? "Submission failed");
      }
    });
  };

  if (done) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-2xl text-emerald-300">
          ✓
        </div>
        <div>
          <p className="text-xl font-semibold tracking-tight text-zinc-100">
            Signed — thank you.
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Your signed copy of <strong>{templateLabel}</strong> has been delivered to the
            landlord and added to your profile.
          </p>
        </div>
        {done.url && (
          <a
            href={done.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20"
          >
            ⬇ Download your signed copy
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Pre-filled fields (read-only) */}
      {Object.keys(prefilled).length > 0 && (
        <section className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            Auto-filled by the landlord
          </p>
          <ul className="space-y-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
            {Object.entries(prefilled).map(([k, v]) => (
              <li key={k} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-zinc-500">{fieldLabel(k)}</span>
                <span className="flex items-center gap-1.5 text-right text-zinc-100">
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-300">
                    verified
                  </span>
                  <span className="font-medium">{v}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Required fields the applicant must complete */}
      {requiredFields.length > 0 && (
        <section className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            Please complete the blanks
          </p>
          <div className="space-y-3">
            {requiredFields.map((token) => (
              <Field key={token} label={fieldLabel(token)}>
                <input
                  required
                  value={fieldValues[token] ?? ""}
                  onChange={(e) =>
                    setFieldValues({ ...fieldValues, [token]: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
            ))}
          </div>
        </section>
      )}

      {requiredFields.length === 0 && Object.keys(prefilled).length === 0 && (
        <p className="rounded-xl border border-zinc-700 bg-zinc-900/40 px-3 py-2.5 text-xs text-zinc-400">
          This document has no fillable fields — review the template and sign below.
        </p>
      )}

      {/* Electronic signature */}
      <section className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">
          Electronic signature
        </p>
        <Field label="Type your full legal name">
          <input
            required
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder="As it should appear on the document"
            className={`${inputClass} font-serif italic`}
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition hover:bg-white/[0.04]">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-emerald-500"
          />
          <span className="text-xs leading-relaxed text-zinc-300">
            I have reviewed the document and agree to be bound by it. I understand
            that typing my name above and clicking <strong>Sign &amp; Submit</strong>{" "}
            constitutes a legally binding electronic signature under the federal
            E-SIGN Act and the Texas Uniform Electronic Transactions Act
            (Tex. Bus. &amp; Comm. Code Ch. 322). My IP and timestamp will be
            recorded with my signature.
          </span>
        </label>
      </section>

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          ⚠ {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !acceptedTerms || !signatureName.trim()}
        className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Submitting…" : "Sign & Submit"}
      </button>

      <p className="text-center text-[10px] text-zinc-500">
        Free e-signature · stored securely · no third-party service required
      </p>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 transition focus:border-emerald-500 focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-emerald-500/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}
