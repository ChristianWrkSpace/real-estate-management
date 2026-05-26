"use client";

import { useState } from "react";

export default function CopyLinkPill({
  url,
  label = "Copy Mobile Link",
  className = "",
}: {
  url: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers blocking clipboard: trigger SMS share if available
      if (typeof window !== "undefined" && navigator.share) {
        try {
          await navigator.share({ url });
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          /* user cancelled */
        }
      }
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={copy}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
          copied
            ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-800 dark:text-emerald-100"
            : "border-emerald-500/50 bg-emerald-500/15 text-emerald-800 hover:border-emerald-500/70 hover:bg-emerald-500/25 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:border-emerald-400/60 dark:hover:bg-emerald-500/20"
        }`}
        aria-live="polite"
      >
        <span className="text-sm">{copied ? "✓" : "📱"}</span>
        <span>{copied ? "Copied — paste in iMessage" : label}</span>
      </button>
    </div>
  );
}
