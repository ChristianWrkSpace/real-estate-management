"use client";

import { useState, useTransition } from "react";
import { updateTenantProfile } from "@/app/actions/profiles";
import EditDrawerShell from "@/components/EditDrawerShell";
import { Field, SectionHeader, DigitalLeaseLinkCard } from "@/components/UnitEditDrawer";
import ContractLibrary from "@/components/ContractLibrary";

export type TenantDrawerData = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  active_lease_id: string | null;
  active_lease_unit_id: string | null;
  active_lease_unit_number: string | null;
  active_lease_monthly_rent: number | null;
  past_due_amount: number;
};

export type UnitOption = { id: string; unit_number: string; status: string };

export default function TenantEditDrawer({
  open,
  tenant,
  units,
  onClose,
}: {
  open: boolean;
  tenant: TenantDrawerData | null;
  units: UnitOption[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<TenantDrawerData | null>(tenant);
  if (tenant && (!form || form.id !== tenant.id)) {
    setForm(tenant);
  }
  if (!tenant || !form) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await updateTenantProfile({
        tenantId: form.id,
        firstName: form.first_name,
        lastName: form.last_name,
        email: form.email,
        phone: form.phone,
        monthlyRent:
          form.active_lease_monthly_rent != null
            ? Number(form.active_lease_monthly_rent)
            : undefined,
        reassignToUnitId:
          form.active_lease_unit_id !== tenant.active_lease_unit_id &&
          form.active_lease_unit_id
            ? form.active_lease_unit_id
            : undefined,
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
      title={`${tenant.first_name} ${tenant.last_name}`}
      subtitle={
        tenant.active_lease_unit_number
          ? `Unit ${tenant.active_lease_unit_number} · status ${tenant.status}`
          : `Status: ${tenant.status} · no active lease`
      }
    >
      <form onSubmit={handleSave} className="space-y-5">
        <SectionHeader>Contact</SectionHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              required
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Last name">
            <input
              required
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Email">
          <input
            type="email"
            value={form.email ?? ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="tenant@example.com"
            className={inputClass}
          />
        </Field>

        <Field label="Phone">
          <input
            type="tel"
            value={form.phone ?? ""}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="(956) 555-0100"
            className={inputClass}
          />
        </Field>

        {form.active_lease_id && (
          <>
            <SectionHeader>Active lease</SectionHeader>

            <Field label="Monthly rent (USD)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.active_lease_monthly_rent ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    active_lease_monthly_rent: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                className={inputClass}
              />
            </Field>

            <Field label="Assigned unit">
              <select
                value={form.active_lease_unit_id ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    active_lease_unit_id: e.target.value || null,
                  })
                }
                className={inputClass}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id} className="bg-zinc-100 dark:bg-zinc-900">
                    Unit {u.unit_number}
                    {u.status === "occupied" && u.id !== tenant.active_lease_unit_id
                      ? " (currently occupied)"
                      : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-zinc-500">
                Reassigning will flip the old unit to <strong>vacant</strong> if no other
                active lease remains, and the new unit to <strong>occupied</strong>.
              </p>
            </Field>
          </>
        )}

        {tenant.past_due_amount > 0 && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
            ⚠ Past-due:{" "}
            <strong>
              {tenant.past_due_amount.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </strong>{" "}
            this month. Use the Enforcement column on the table to issue a 3-day notice.
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            ⚠ {error}
          </p>
        )}
        {saved && (
          <p className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            ✓ Saved.
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/15 transition hover:from-emerald-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save Tenant"}
        </button>
      </form>

      <div className="mt-6 space-y-2">
        <SectionHeader>Digital Lease Agreement</SectionHeader>
        <DigitalLeaseLinkCard
          leaseId={tenant.active_lease_id}
          contextHint={
            tenant.active_lease_id
              ? `One-time-use 24-byte token. Send to ${tenant.first_name} via iMessage / WhatsApp; the link expires when accepted or regenerated.`
              : "No active lease yet. Create one for this tenant first."
          }
        />
      </div>

      <div className="mt-6">
        <ContractLibrary
          tenantId={tenant.id}
          tenantHasActiveLease={!!tenant.active_lease_id}
        />
      </div>
    </EditDrawerShell>
  );
}

const inputClass =
  "w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-60";
