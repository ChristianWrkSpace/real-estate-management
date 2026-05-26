"use client";

import { useState, useTransition } from "react";
import { updateUnitProfile } from "@/app/actions/profiles";
import { createOnboardingInvite } from "@/app/actions/onboarding";
import EditDrawerShell from "@/components/EditDrawerShell";
import CopyLinkPill from "@/components/CopyLinkPill";

export type UnitDrawerData = {
  id: string;
  unit_number: string;
  monthly_rent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  status: "occupied" | "vacant" | "maintenance";
  notes: string | null;
  active_lease_id: string | null;
  tenant_name: string | null;
};

export default function UnitEditDrawer({
  open,
  unit,
  onClose,
}: {
  open: boolean;
  unit: UnitDrawerData | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<UnitDrawerData | null>(unit);

  // Re-hydrate when the drawer opens for a different unit
  if (unit && (!form || form.id !== unit.id)) {
    setForm(unit);
  }

  if (!unit || !form) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await updateUnitProfile({
        unitId: form.id,
        marketRent:
          form.monthly_rent === null
            ? null
            : Number(form.monthly_rent),
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        sqft: form.sqft,
        status: form.status,
        notes: form.notes,
      });
      if (r.success) {
        setSaved(true);
      } else {
        setError(r.error ?? "Update failed");
      }
    });
  };

  return (
    <EditDrawerShell
      open={open}
      onClose={onClose}
      title={`Unit ${unit.unit_number}`}
      subtitle={
        unit.tenant_name
          ? `Occupied · ${unit.tenant_name}`
          : `Status: ${unit.status}`
      }
    >
      <form onSubmit={handleSave} className="space-y-5">
        <SectionHeader>Specifications</SectionHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bedrooms">
            <input
              type="number"
              min="0"
              max="20"
              value={form.bedrooms ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  bedrooms: e.target.value ? Number(e.target.value) : null,
                })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Bathrooms">
            <input
              type="number"
              step="0.5"
              min="0"
              max="20"
              value={form.bathrooms ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  bathrooms: e.target.value ? Number(e.target.value) : null,
                })
              }
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Square footage">
          <input
            type="number"
            min="0"
            value={form.sqft ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                sqft: e.target.value ? Number(e.target.value) : null,
              })
            }
            className={inputClass}
          />
        </Field>

        <Field label="Market rent baseline (USD / month)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.monthly_rent ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                monthly_rent: e.target.value ? Number(e.target.value) : null,
              })
            }
            className={inputClass}
          />
        </Field>

        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value as UnitDrawerData["status"],
              })
            }
            className={inputClass}
          >
            <option value="vacant" className="bg-zinc-100 dark:bg-zinc-900">Vacant</option>
            <option value="occupied" className="bg-zinc-100 dark:bg-zinc-900">Occupied</option>
            <option value="maintenance" className="bg-zinc-100 dark:bg-zinc-900">Maintenance</option>
          </select>
        </Field>

        <Field label="Structural notes">
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            placeholder='e.g., "New refrigerator installed May 2026. Replaced kitchen faucet Apr 2026."'
            className={inputClass}
          />
        </Field>

        {error && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            ⚠ {error}
          </p>
        )}
        {saved && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            ✓ Saved.
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/15 transition hover:from-emerald-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save Unit"}
        </button>
      </form>

      {/* Digital Lease Agreement Link */}
      <div className="mt-6 space-y-2">
        <SectionHeader>Digital Lease Agreement</SectionHeader>
        <DigitalLeaseLinkCard
          leaseId={unit.active_lease_id}
          contextHint={
            unit.active_lease_id
              ? `Generates a single-use onboarding URL for ${unit.tenant_name ?? "the active lease"}.`
              : "Create an active lease for this unit first, then generate an onboarding URL."
          }
        />
      </div>
    </EditDrawerShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

const inputClass =
  "w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-60";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
      {children}
    </h3>
  );
}

export function DigitalLeaseLinkCard({
  leaseId,
  contextHint,
}: {
  leaseId: string | null;
  contextHint: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    if (!leaseId) return;
    setError(null);
    setUrl(null);
    startTransition(async () => {
      const r = await createOnboardingInvite(leaseId);
      if (r.success && r.url) {
        setUrl(r.url);
      } else {
        setError(r.error ?? "Failed to generate link");
      }
    });
  };

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-zinc-950 to-blue-500/10 p-4 shadow-[0_0_28px_rgba(16,185,129,0.10)]">
      <p className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Generate Digital Lease Agreement Link
      </p>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{contextHint}</p>

      {!url && (
        <button
          type="button"
          onClick={generate}
          disabled={!leaseId || isPending}
          className="mt-3 w-full rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(16,185,129,0.30)] transition hover:from-emerald-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Minting…" : leaseId ? "Issue Onboarding Link" : "No active lease"}
        </button>
      )}

      {url && (
        <div className="mt-3 space-y-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate rounded-md border border-emerald-500/30 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1.5 font-mono text-[11px] text-emerald-200 underline-offset-2 hover:underline"
            title={url}
          >
            {url}
          </a>
          <CopyLinkPill url={url} />
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
