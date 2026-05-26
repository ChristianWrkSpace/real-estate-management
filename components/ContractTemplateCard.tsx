"use client";

import { useRef, useState, useTransition } from "react";
import type { ContractTemplateDetail } from "@/app/actions/contracts";
import {
  replaceContractTemplate,
  updateContractTemplate,
} from "@/app/actions/contracts";

export default function ContractTemplateCard({
  template,
}: {
  template: ContractTemplateDetail;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [local, setLocal] = useState({
    label: template.label,
    description: template.description ?? "",
    active: template.active,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState(false);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await updateContractTemplate({
        templateId: template.id,
        label: local.label,
        description: local.description,
        active: local.active,
      });
      if (r.success) {
        setEditing(false);
        setConfirmation("Saved.");
        setTimeout(() => setConfirmation(null), 1800);
      } else {
        setError(r.error ?? "Save failed");
      }
    });
  };

  const replace = (file: File) => {
    setError(null);
    setReplacing(true);
    const fd = new FormData();
    fd.set("templateId", template.id);
    fd.set("file", file);
    startTransition(async () => {
      const r = await replaceContractTemplate(fd);
      if (r.success) {
        setConfirmation(
          `Replaced — ${(r.placeholders ?? []).length} placeholder${
            (r.placeholders ?? []).length === 1 ? "" : "s"
          } detected.`
        );
        // Reload so server-rendered card reflects new storage_key / uploaded_at
        if (typeof window !== "undefined") {
          setTimeout(() => window.location.reload(), 900);
        }
      } else {
        setError(r.error ?? "Replace failed");
        setReplacing(false);
      }
    });
  };

  return (
    <div
      className={`rounded-xl border p-5 shadow-xl transition ${
        template.active
          ? "border-zinc-800 bg-zinc-900/80 hover:border-zinc-700"
          : "border-zinc-800 bg-zinc-900/40 opacity-70"
      }`}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              value={local.label}
              onChange={(e) => setLocal({ ...local, label: e.target.value })}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm font-semibold text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          ) : (
            <h3 className="truncate text-base font-semibold tracking-tight text-zinc-100">
              {template.label}
            </h3>
          )}
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            kind: {template.kind} · .{template.file_extension}
            {template.uploaded_at && (
              <span>
                {" "}· uploaded {new Date(template.uploaded_at).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
            template.active
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
              : "border-zinc-700 bg-zinc-950 text-zinc-500"
          }`}
        >
          {template.active ? "active" : "inactive"}
        </span>
      </header>

      {editing ? (
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Description
            </span>
            <textarea
              value={local.description}
              onChange={(e) => setLocal({ ...local, description: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5">
            <input
              type="checkbox"
              checked={local.active}
              onChange={(e) => setLocal({ ...local, active: e.target.checked })}
              className="h-3.5 w-3.5 accent-emerald-500"
            />
            <span className="text-xs text-zinc-300">
              Available in the tenant Contract Library
            </span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="rounded-md bg-gradient-to-r from-emerald-500 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:to-blue-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setLocal({
                  label: template.label,
                  description: template.description ?? "",
                  active: template.active,
                });
                setEditing(false);
              }}
              disabled={isPending}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {template.description && (
            <p className="mb-3 text-xs leading-relaxed text-zinc-400">
              {template.description}
            </p>
          )}

          <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Placeholders ({template.placeholders.length})
            </p>
            {template.placeholders.length === 0 ? (
              <p className="mt-1 text-[11px] text-zinc-500">
                None detected — this template is a static document (no fill-in
                fields).
              </p>
            ) : (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {template.placeholders.map((p) => (
                  <li
                    key={p}
                    className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {template.download_url && (
              <a
                href={template.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-900"
              >
                ⬇ Download original
              </a>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={replacing || isPending}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {replacing ? "Replacing…" : "⤒ Replace .docx"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) replace(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-900"
            >
              ✎ Edit
            </button>
          </div>
        </>
      )}

      {confirmation && (
        <p className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-200">
          ✓ {confirmation}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
