"use client";

import { useEffect, useState, useTransition } from "react";
import {
  generateContractForTenant,
  getTenantDocuments,
  listContractTemplates,
  type ContractTemplate,
  type TenantDocument,
} from "@/app/actions/contracts";
import { createSigningRequest } from "@/app/actions/signing";
import CopyLinkPill from "@/components/CopyLinkPill";

export default function ContractLibrary({
  tenantId,
  tenantHasActiveLease,
}: {
  tenantId: string;
  tenantHasActiveLease: boolean;
}) {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [sendingKind, setSendingKind] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [justGenerated, setJustGenerated] = useState<{
    kind: string;
    url: string;
    unfilled: string[];
  } | null>(null);
  const [justSent, setJustSent] = useState<{
    kind: string;
    url: string;
    required: string[];
    prefilledCount: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listContractTemplates(), getTenantDocuments(tenantId)])
      .then(([t, d]) => {
        if (cancelled) return;
        setTemplates(t);
        setDocuments(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Failed to load contracts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const generate = (kind: string) => {
    setError(null);
    setBusyKind(kind);
    setJustGenerated(null);
    setJustSent(null);
    startTransition(async () => {
      const r = await generateContractForTenant({ tenantId, templateKind: kind });
      if (r.success && r.download_url) {
        setJustGenerated({
          kind,
          url: r.download_url,
          unfilled: r.unfilled_placeholders ?? [],
        });
        // Refresh saved-docs list
        const d = await getTenantDocuments(tenantId);
        setDocuments(d);
      } else {
        setError(r.error ?? "Generation failed");
      }
      setBusyKind(null);
    });
  };

  const sendForSignature = (kind: string) => {
    setError(null);
    setSendingKind(kind);
    setJustGenerated(null);
    setJustSent(null);
    startTransition(async () => {
      const r = await createSigningRequest({ tenantId, templateKind: kind });
      if (r.success && r.url) {
        setJustSent({
          kind,
          url: r.url,
          required: r.required_fields ?? [],
          prefilledCount: r.prefilled_count ?? 0,
        });
      } else {
        setError(r.error ?? "Could not create signing link");
      }
      setSendingKind(null);
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        Contract Library
      </h3>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-4">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Generate any template filled with this tenant&apos;s current profile +
          active lease. Saved to <span className="text-zinc-700 dark:text-zinc-300">contracts</span>{" "}
          bucket and attached to the tenant&apos;s profile.
        </p>

        {loading && (
          <p className="mt-3 text-xs text-zinc-500">Loading templates…</p>
        )}

        {!loading && templates.length === 0 && (
          <p className="mt-3 text-xs text-amber-300">
            No templates registered. Run <code>npx tsx scripts/upload-templates.ts</code>.
          </p>
        )}

        {!loading && templates.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-2">
            {templates.map((t) => {
              const isLeaseLike =
                t.kind === "lease_full" || t.kind === "lease_short";
              const blockedByMissingLease = isLeaseLike && !tenantHasActiveLease;
              const isBusy = busyKind === t.kind;
              const isSending = sendingKind === t.kind;
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                        {t.label}
                      </p>
                      {t.description && (
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          {t.description}
                        </p>
                      )}
                      {t.placeholders.length > 0 && (
                        <p className="mt-1 font-mono text-[10px] text-zinc-600">
                          {t.placeholders.length} placeholder
                          {t.placeholders.length === 1 ? "" : "s"} ·{" "}
                          {t.placeholders.slice(0, 3).join(", ")}
                          {t.placeholders.length > 3 ? "…" : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => generate(t.kind)}
                        disabled={isBusy || isSending || blockedByMissingLease}
                        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 transition hover:border-emerald-400/60 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isBusy ? "Generating…" : "Generate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => sendForSignature(t.kind)}
                        disabled={isBusy || isSending || blockedByMissingLease}
                        className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-200 transition hover:border-blue-400/60 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isSending ? "Sending…" : "Send for Signature"}
                      </button>
                    </div>
                  </div>
                  {blockedByMissingLease && (
                    <p className="mt-2 text-[10px] text-amber-300/80">
                      Needs an active lease to fill rent / unit fields. Create
                      one for this tenant first.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {justGenerated && (
          <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 shadow-[0_0_28px_rgba(16,185,129,0.15)]">
            <p className="text-sm font-semibold tracking-tight text-emerald-100">
              ✓ Generated {justGenerated.kind.replace(/_/g, " ")}
            </p>
            <p className="mt-1 text-[11px] text-emerald-200/80">
              Saved to this tenant&apos;s profile and to the contracts bucket.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a
                href={justGenerated.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-emerald-500/40 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-zinc-900"
              >
                ⬇ Download .docx
              </a>
              <CopyLinkPill url={justGenerated.url} label="Copy share link" />
            </div>
            {justGenerated.unfilled.length > 0 && (
              <p className="mt-2 font-mono text-[10px] text-amber-300/80">
                Still to fill by hand: {justGenerated.unfilled.join(", ")}
              </p>
            )}
          </div>
        )}

        {justSent && (
          <div className="mt-3 rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 shadow-[0_0_28px_rgba(59,130,246,0.15)]">
            <p className="text-sm font-semibold tracking-tight text-blue-100">
              ✓ Signing link ready — {justSent.kind.replace(/_/g, " ")}
            </p>
            <p className="mt-1 text-[11px] text-blue-200/80">
              {justSent.prefilledCount} field
              {justSent.prefilledCount === 1 ? "" : "s"} pre-filled from this
              tenant&apos;s profile. Link expires in 30 days.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a
                href={justSent.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-blue-500/40 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-blue-200 hover:bg-zinc-900"
              >
                ↗ Open signing page
              </a>
              <CopyLinkPill url={justSent.url} label="Copy signing link" />
            </div>
            {justSent.required.length > 0 && (
              <p className="mt-2 font-mono text-[10px] text-amber-300/80">
                Tenant will be asked to fill: {justSent.required.join(", ")}
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">
            ⚠ {error}
          </p>
        )}
      </div>

      {/* Saved documents list */}
      {documents.length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Saved to profile
          </p>
          <ul className="mt-2 space-y-1.5">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <div className="min-w-0">
                  <p className="truncate text-zinc-800 dark:text-zinc-200" title={d.label}>
                    {d.label}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {new Date(d.generated_at).toLocaleString()} ·{" "}
                    {d.signed_at ? `signed ${new Date(d.signed_at).toLocaleDateString()}` : "unsigned"}
                  </p>
                </div>
                {d.download_url && (
                  <a
                    href={d.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-900"
                  >
                    open
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
