"use client";

import { useRef, useState, useTransition } from "react";
import { uploadLeaseDocument } from "@/app/actions/leases";

export default function LeasePdfUpload({
  tenantId,
  existingUrl,
}: {
  tenantId: string;
  existingUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(existingUrl);

  const submit = (file: File) => {
    setError(null);
    const fd = new FormData();
    fd.set("tenantId", tenantId);
    fd.set("file", file);
    startTransition(async () => {
      const result = await uploadLeaseDocument(fd);
      if (result.success && result.url) {
        setUrl(result.url);
      } else {
        setError(result.error || "Upload failed");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) submit(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`group flex min-w-[180px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs font-semibold backdrop-blur-md transition ${
          dragOver
            ? "border-indigo-400/60 bg-indigo-500/15 text-indigo-100"
            : url
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
              : "border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10"
        } ${isPending ? "opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) submit(file);
            e.target.value = "";
          }}
        />
        {isPending ? (
          <span>Uploading…</span>
        ) : url ? (
          <span className="flex items-center gap-2">
            ✓ Lease on file
            <span className="text-white/40">· drop to replace</span>
          </span>
        ) : (
          <span>📎 Drop PDF or click</span>
        )}
      </div>

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-indigo-300 underline-offset-2 hover:underline"
        >
          View current lease →
        </a>
      )}

      {error && <p className="text-[10px] text-red-300">{error}</p>}
    </div>
  );
}
