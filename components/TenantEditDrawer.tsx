"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateProspectLease, endActiveLease, updateTenantProfile } from "@/app/actions/profiles";
import EditDrawerShell from "@/components/EditDrawerShell";
import { Field, SectionHeader, DigitalLeaseLinkCard } from "@/components/UnitEditDrawer";
import ContractLibrary from "@/components/ContractLibrary";
import CopyLinkPill from "@/components/CopyLinkPill";

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

      {tenant.active_lease_id ? (
        <>
          <div className="mt-6 space-y-2">
            <SectionHeader>Digital Lease Agreement</SectionHeader>
            <DigitalLeaseLinkCard
              leaseId={tenant.active_lease_id}
              contextHint={`One-time-use 24-byte token. Send to ${tenant.first_name} via iMessage / WhatsApp; the link expires when accepted or regenerated.`}
            />
          </div>
          <div className="mt-6 space-y-2">
            <SectionHeader>End lease / move-out</SectionHeader>
            <EndLeaseCard
              tenantId={tenant.id}
              tenantFirstName={tenant.first_name}
              unitNumber={tenant.active_lease_unit_number}
              onEnded={onClose}
            />
          </div>
        </>
      ) : (
        <div className="mt-6 space-y-2">
          <SectionHeader>Convert to Active Tenant</SectionHeader>
          <ProspectActivationCard
            tenantId={tenant.id}
            tenantFirstName={tenant.first_name}
            units={units}
            onActivated={onClose}
          />
        </div>
      )}

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

function ProspectActivationCard({
  tenantId,
  tenantFirstName,
  units,
  onActivated,
}: {
  tenantId: string;
  tenantFirstName: string;
  units: UnitOption[];
  onActivated: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ onboardingUrl?: string } | null>(null);

  const vacantUnits = units.filter((u) => u.status !== "occupied");
  const firstVacant = vacantUnits[0]?.id ?? units[0]?.id ?? "";

  const [form, setForm] = useState({
    unitId: firstVacant,
    monthlyRent: "",
    securityDeposit: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    leaseType: "fixed" as "fixed" | "month-to-month",
    generateOnboardingToken: true,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await activateProspectLease({
        tenantId,
        unitId: form.unitId,
        monthlyRent: Number(form.monthlyRent),
        securityDeposit: form.securityDeposit ? Number(form.securityDeposit) : null,
        startDate: form.startDate,
        endDate: form.endDate || null,
        leaseType: form.leaseType,
        generateOnboardingToken: form.generateOnboardingToken,
      });
      if (r.success) {
        setDone({ onboardingUrl: r.onboarding_url });
        router.refresh();
      } else {
        setError(r.error ?? "Could not activate lease");
      }
    });
  };

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-500/50 bg-emerald-500/15 p-4 dark:border-emerald-500/40 dark:bg-emerald-500/10">
        <p className="text-sm font-semibold tracking-tight text-emerald-900 dark:text-emerald-100">
          ✓ {tenantFirstName} is now an active tenant.
        </p>
        <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-200/80">
          Lease created, unit flipped to <strong>occupied</strong>, status updated.
        </p>
        {done.onboardingUrl && (
          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-300">
              Onboarding link (send to {tenantFirstName})
            </p>
            <a
              href={done.onboardingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate rounded-md border border-emerald-500/50 bg-white px-2.5 py-1.5 font-mono text-[11px] text-emerald-800 underline-offset-2 hover:underline dark:border-emerald-500/30 dark:bg-zinc-950 dark:text-emerald-200"
              title={done.onboardingUrl}
            >
              {done.onboardingUrl}
            </a>
            <CopyLinkPill url={done.onboardingUrl} label="Copy onboarding link" />
          </div>
        )}
        <button
          type="button"
          onClick={onActivated}
          className="mt-4 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Close — reopen to manage the new lease
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-xs text-zinc-700 dark:text-zinc-400">
        Assign {tenantFirstName} to a unit and create their first lease. The unit
        flips to <strong>occupied</strong> and the tenant&apos;s status moves from{" "}
        <strong>prospect</strong> to <strong>active</strong>.
      </p>

      <Field label="Unit">
        <select
          required
          value={form.unitId}
          onChange={(e) => setForm({ ...form, unitId: e.target.value })}
          className={inputClass}
        >
          {units.length === 0 && <option value="">No units available</option>}
          {units.map((u) => (
            <option
              key={u.id}
              value={u.id}
              className="bg-zinc-100 dark:bg-zinc-900"
            >
              Unit {u.unit_number}
              {u.status === "occupied" ? " (currently occupied — will reassign)" : ""}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Monthly rent (USD)">
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={form.monthlyRent}
            onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })}
            placeholder="1500"
            className={inputClass}
          />
        </Field>
        <Field label="Security deposit">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.securityDeposit}
            onChange={(e) => setForm({ ...form, securityDeposit: e.target.value })}
            placeholder="1500"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <input
            required
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="End date (optional)">
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Lease type">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, leaseType: "fixed" })}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              form.leaseType === "fixed"
                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-600"
            }`}
          >
            Fixed term
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, leaseType: "month-to-month" })}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              form.leaseType === "month-to-month"
                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-600"
            }`}
          >
            Month-to-month
          </button>
        </div>
      </Field>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-200 bg-white p-3 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700">
        <input
          type="checkbox"
          checked={form.generateOnboardingToken}
          onChange={(e) =>
            setForm({ ...form, generateOnboardingToken: e.target.checked })
          }
          className="mt-0.5 h-4 w-4 accent-emerald-500"
        />
        <span className="text-xs text-zinc-700 dark:text-zinc-300">
          Mint a one-time onboarding link so {tenantFirstName} can review &amp;
          e-sign the lease.{" "}
          <span className="text-zinc-500">
            You&apos;ll get a copyable URL after activation.
          </span>
        </span>
      </label>

      {error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          ⚠ {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !form.unitId}
        className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/15 transition hover:from-emerald-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Activating…" : `Activate Lease for ${tenantFirstName}`}
      </button>
    </form>
  );
}

function EndLeaseCard({
  tenantId,
  tenantFirstName,
  unitNumber,
  onEnded,
}: {
  tenantId: string;
  tenantFirstName: string;
  unitNumber: string | null;
  onEnded: () => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");

  const expected = `END ${tenantFirstName.toUpperCase()}`;
  const canSubmit = confirm.trim() === expected;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setError(`Type ${expected} to confirm.`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await endActiveLease({
        tenantId,
        endDate,
        reason: reason.trim() || null,
      });
      if (r.success) {
        router.refresh();
        onEnded();
      } else {
        setError(r.error ?? "Could not end lease");
      }
    });
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-left text-xs text-rose-800 transition hover:border-rose-500/60 hover:bg-rose-500/15 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15"
      >
        <p className="font-semibold">End {tenantFirstName}&apos;s lease</p>
        <p className="mt-0.5 text-[11px] opacity-80">
          Move-out, eviction, lease termination — frees{" "}
          {unitNumber ? `Unit ${unitNumber}` : "the unit"} for the next tenant.
        </p>
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 dark:border-rose-500/30"
    >
      <p className="text-xs text-rose-800 dark:text-rose-200">
        Ending this lease will:
      </p>
      <ul className="ml-4 list-disc space-y-1 text-[11px] text-rose-800 dark:text-rose-200/90 marker:text-rose-500">
        <li>Set the lease&apos;s status to <strong>terminated</strong>.</li>
        <li>
          Flip {unitNumber ? <strong>Unit {unitNumber}</strong> : "the unit"} to{" "}
          <strong>vacant</strong> (so you can assign someone else).
        </li>
        <li>
          Move {tenantFirstName}&apos;s tenant status to <strong>former</strong>{" "}
          (their history stays for the record).
        </li>
      </ul>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Move-out / end date">
          <input
            required
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Reason (optional, audit)">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lease expired, eviction, mutual…"
            className={inputClass}
          />
        </Field>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          Type{" "}
          <span className="font-mono text-rose-700 dark:text-rose-300">
            {expected}
          </span>{" "}
          to confirm
        </span>
        <input
          required
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          className={inputClass}
        />
      </label>

      {error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          ⚠ {error}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending || !canSubmit}
          className="flex-1 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Ending…" : `End lease for ${tenantFirstName}`}
        </button>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setError(null);
            setConfirm("");
            setReason("");
          }}
          disabled={isPending}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
