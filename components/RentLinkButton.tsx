"use client";

import { useState, useTransition } from "react";
import { createRentPaymentLink } from "@/app/actions/finance";

export default function RentLinkButton({ tenantId }: { tenantId: string }) {
  const [isPending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = () => {
    setError(null);
    setUrl(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createRentPaymentLink(tenantId);
      if (result.success && result.url) {
        setUrl(result.url);
        try {
          await navigator.clipboard.writeText(result.url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          // clipboard blocked — link still shown
        }
      } else {
        setError(result.error || "Failed to generate link");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={generate}
        disabled={isPending}
        className="rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200 backdrop-blur-md transition hover:border-blue-300/60 hover:bg-blue-500/20 hover:text-white disabled:opacity-50"
      >
        {isPending ? "Generating…" : url ? "Regenerate" : "Generate Rent Link"}
      </button>

      {url && (
        <div className="flex items-center gap-2 text-xs">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-[220px] truncate text-blue-300 underline-offset-2 hover:underline"
            title={url}
          >
            {url}
          </a>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              } catch {
                /* no-op */
              }
            }}
            className="rounded border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 px-2 py-1 text-[10px] text-zinc-600 dark:text-white/70 hover:bg-white/10"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
