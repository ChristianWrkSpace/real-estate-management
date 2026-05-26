"use client";

import { useState, useTransition } from "react";
import { createTenant } from "@/app/actions/profiles";
import CopyLinkPill from "@/components/CopyLinkPill";

export type AddTenantUnit = {
  id: string;
  unit_number: string;
  status: string;
  monthly_rent: number | null;
};

export default function AddTenantModal({ units }: { units: AddTenantUnit[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    tenantId: string;
    onboardingUrl?: string;
    unitFlipped: boolean;
  } | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    notes: "",
    unitId: "",
    monthlyRent: "",
    securityDeposit: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    leaseType: "fixed" as "fixed" | "month-to-month",
    generateOnboardingToken: true,
  });

  const reset = () => {
    setOpen(false);
    setSuccess(null);
    setError(null);
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      notes: "",
      unitId: "",
      monthlyRent: "",
      securityDeposit: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      leaseType: "fixed",
      generateOnboardingToken: true,
    });
  };

  const onUnitChange = (unitId: string) => {
    const u = units.find((x) => x.id === unitId);
    setForm({
      ...form,
      unitId,
      monthlyRent:
        u?.monthly_rent != null ? String(u.monthly_rent) : form.monthlyRent,
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const r = await createTenant({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || null,
        phone: form.phone || null,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
        notes: form.notes || null,
        unitId: form.unitId || null,
        monthlyRent: form.monthlyRent ? Number(form.monthlyRent) : null,
        securityDeposit: form.securityDeposit ? Number(form.securityDeposit) : null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        leaseType: form.leaseType,
        generateOnboardingToken: form.generateOnboardingToken && !!form.unitId,
      });
      if (r.success) {
        setSuccess({
          tenantId: r.tenant_id!,
          onboardingUrl: r.onboarding_url,
          unitFlipped: !!r.unit_flipped_occupied,
        });
      } else {
        setError(r.error ?? "Failed to add tenant");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/15 transition hover:from-emerald-600 hover:to-blue-700"
      >
        + Add Tenant
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={reset}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 p-5">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Add Tenant
                </h2>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  {success
                    ? "Tenant saved"
                    : "Create a profile · optionally assign a unit & mint an onboarding link"}
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="rounded-md p-1.5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="Close"
              >
                ✕
              </button>
            </header>

            <div className="max-h-[78vh] overflow-y-auto p-5">
              {success ? (
                <SuccessPanel
                  onboardingUrl={success.onboardingUrl}
                  unitFlipped={success.unitFlipped}
                  onClose={reset}
                />
              ) : (
                <form onSubmit={submit} className="space-y-5">
                  <Section title="Contact">
                    <Grid2>
                      <Field label="First name *">
                        <input
                          required
                          value={form.firstName}
                          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Last name *">
                        <input
                          required
                          value={form.lastName}
                          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                          className={inputClass}
                        />
                      </Field>
                    </Grid2>

                    <Grid2>
                      <Field label="Email">
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="tenant@example.com"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Phone">
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="(956) 555-0100"
                          className={inputClass}
                        />
                      </Field>
                    </Grid2>

                    <Grid2>
                      <Field label="Emergency contact name">
                        <input
                          value={form.emergencyContactName}
                          onChange={(e) =>
                            setForm({ ...form, emergencyContactName: e.target.value })
                          }
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Emergency contact phone">
                        <input
                          type="tel"
                          value={form.emergencyContactPhone}
                          onChange={(e) =>
                            setForm({ ...form, emergencyContactPhone: e.target.value })
                          }
                          className={inputClass}
                        />
                      </Field>
                    </Grid2>

                    <Field label="Notes">
                      <textarea
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        rows={2}
                        placeholder="Pets, preferred contact time, anything else…"
                        className={inputClass}
                      />
                    </Field>
                  </Section>

                  <Section title="Lease (optional)">
                    <Field label="Assigned unit">
                      <select
                        value={form.unitId}
                        onChange={(e) => onUnitChange(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">— Prospect only, no lease yet —</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id} className="bg-zinc-100 dark:bg-zinc-900">
                            Unit {u.unit_number}
                            {u.status === "occupied" ? " (currently occupied — will reassign)" : ""}
                            {u.monthly_rent != null ? ` · $${u.monthly_rent}/mo baseline` : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-zinc-500">
                        Selecting a unit will create an active lease and flip the unit to
                        <strong> occupied</strong>. Leave blank to add the tenant as a
                        prospect.
                      </p>
                    </Field>

                    {form.unitId && (
                      <>
                        <Grid2>
                          <Field label="Monthly rent (USD) *">
                            <input
                              required={!!form.unitId}
                              type="number"
                              step="0.01"
                              min="0"
                              value={form.monthlyRent}
                              onChange={(e) =>
                                setForm({ ...form, monthlyRent: e.target.value })
                              }
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Security deposit (USD)">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={form.securityDeposit}
                              onChange={(e) =>
                                setForm({ ...form, securityDeposit: e.target.value })
                              }
                              className={inputClass}
                            />
                          </Field>
                        </Grid2>

                        <Grid2>
                          <Field label="Lease start">
                            <input
                              type="date"
                              required={!!form.unitId}
                              value={form.startDate}
                              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Lease end (optional)">
                            <input
                              type="date"
                              value={form.endDate}
                              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                              className={inputClass}
                            />
                          </Field>
                        </Grid2>

                        <Field label="Lease type">
                          <div className="flex gap-2">
                            <RadioPill
                              checked={form.leaseType === "fixed"}
                              onChange={() =>
                                setForm({ ...form, leaseType: "fixed" })
                              }
                              label="Fixed term"
                            />
                            <RadioPill
                              checked={form.leaseType === "month-to-month"}
                              onChange={() =>
                                setForm({ ...form, leaseType: "month-to-month" })
                              }
                              label="Month-to-month"
                            />
                          </div>
                        </Field>

                        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 p-3 transition hover:border-zinc-700">
                          <input
                            type="checkbox"
                            checked={form.generateOnboardingToken}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                generateOnboardingToken: e.target.checked,
                              })
                            }
                            className="mt-0.5 h-4 w-4 accent-emerald-500"
                          />
                          <span className="text-xs text-zinc-700 dark:text-zinc-300">
                            Mint a one-time onboarding link so {form.firstName || "the tenant"}{" "}
                            can review &amp; e-sign the lease.{" "}
                            <span className="text-zinc-500">
                              You can copy + text the URL after save.
                            </span>
                          </span>
                        </label>
                      </>
                    )}
                  </Section>

                  {error && (
                    <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                      ⚠ {error}
                    </p>
                  )}

                  <div className="flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/15 transition hover:from-emerald-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPending ? "Saving…" : "Save Tenant"}
                    </button>
                    <button
                      type="button"
                      onClick={reset}
                      disabled={isPending}
                      className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SuccessPanel({
  onboardingUrl,
  unitFlipped,
  onClose,
}: {
  onboardingUrl?: string;
  unitFlipped: boolean;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-2xl text-emerald-300">
        ✓
      </div>
      <div>
        <p className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Tenant added.
        </p>
        {unitFlipped && (
          <p className="mt-1 text-xs text-emerald-300">
            Unit flipped to <strong>occupied</strong>.
          </p>
        )}
      </div>

      {onboardingUrl ? (
        <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-zinc-950 to-blue-500/10 p-4 shadow-[0_0_28px_rgba(16,185,129,0.10)] text-left">
          <p className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Onboarding link minted
          </p>
          <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
            One-time use · 24-byte token. Send via iMessage; the link expires when
            accepted or regenerated.
          </p>
          <a
            href={onboardingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block truncate rounded-md border border-emerald-500/30 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1.5 font-mono text-[11px] text-emerald-200 hover:underline"
            title={onboardingUrl}
          >
            {onboardingUrl}
          </a>
          <div className="mt-2 flex justify-center">
            <CopyLinkPill url={onboardingUrl} />
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          No lease created — added as a prospect. You can assign a unit later from
          the tenant&apos;s edit drawer.
        </p>
      )}

      <button
        type="button"
        onClick={onClose}
        className="mt-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-4 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-900"
      >
        Done
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Form primitives

const inputClass =
  "w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-60";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({
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

function RadioPill({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
        checked
          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
          : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}
