"use client";

import { useState, useTransition } from "react";
import { createOnboardingInvite } from "@/app/actions/onboarding";

export default function OnboardInviteButton({ tenantId }: { tenantId: string }) {
  const [isPending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const invite = () => {
    setError(null);
    setUrl(null);
    startTransition(async () => {
      // We need the active lease id for this tenant. Use the server action
      // helper inline: fetch the lease via supabase from the wrapper action.
      const res = await fetch(`/api/onboard-invite?tenantId=${tenantId}`, {
        method: "POST",
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (json.url) {
        setUrl(json.url);
        try {
          await navigator.clipboard.writeText(json.url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          /* clipboard blocked */
        }
      } else {
        setError(json.error || "Failed to mint invite");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={invite}
        disabled={isPending}
        className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 backdrop-blur-md transition hover:border-emerald-300/60 hover:bg-emerald-500/20 hover:text-white disabled:opacity-50"
      >
        {isPending ? "Minting…" : url ? "Regenerate Invite" : "Onboard Tenant"}
      </button>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-[220px] truncate text-[10px] text-emerald-300 underline-offset-2 hover:underline"
          title={url}
        >
          {copied ? "Copied!" : url}
        </a>
      )}
      {error && <p className="text-[10px] text-red-300">{error}</p>}
    </div>
  );
}
