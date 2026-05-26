"use client";

import { useState, useTransition } from "react";
import { logMaintenance } from "@/app/actions/maintenance";

type Unit = { id: string; unit_number: string };
type Vendor = { id: string; name: string; trade: string | null };

export default function MaintenanceNoteForm({
  units,
  vendors,
}: {
  units: Unit[];
  vendors: Vendor[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    unitId: "",
    description: "",
    amount: "",
    vendorId: "",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const amountNum = form.amount.trim() ? Number(form.amount) : null;
    if (form.amount.trim() && (!Number.isFinite(amountNum) || (amountNum ?? 0) < 0)) {
      setError("Amount must be a non-negative number.");
      return;
    }
    startTransition(async () => {
      const r = await logMaintenance({
        unitId: form.unitId || null,
        description: form.description,
        amount: amountNum,
        vendorId: form.vendorId || null,
      });
      if (r.success) {
        if (r.error) {
          setError(r.error);
        } else if (r.transaction_id) {
          setSuccess(`Logged + expense posted (${r.work_order_id?.slice(0, 8)}…).`);
        } else {
          setSuccess(`Work order opened (${r.work_order_id?.slice(0, 8)}…).`);
        }
        setForm({ unitId: "", description: "", amount: "", vendorId: "" });
      } else {
        setError(r.error || "Failed to log maintenance");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 via-orange-950/20 to-slate-900/60 p-5 backdrop-blur-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300/80">
            ⚒ Maintenance Note
          </span>
          <p className="mt-1 text-xs text-white/50">
            Logs a work order + (if amount entered) posts an expense to the unit's P&amp;L
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Unit">
            <select
              value={form.unitId}
              onChange={(e) => setForm({ ...form, unitId: e.target.value })}
              className={inputClass}
            >
              <option value="">— Common area —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id} className="bg-slate-900">
                  Unit {u.unit_number}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Vendor (optional)">
            <select
              value={form.vendorId}
              onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
              className={inputClass}
            >
              <option value="">— Self / unassigned —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id} className="bg-slate-900">
                  {v.name}
                  {v.trade ? ` · ${v.trade}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description">
          <input
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="e.g., Unit 1 plumbing issue — kitchen P-trap leak"
            className={inputClass}
          />
        </Field>

        <Field label="Cost (USD) — leave blank to open ticket only">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
            className={inputClass}
          />
        </Field>

        {error && (
          <p className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            ⚠ {error}
          </p>
        )}
        {success && (
          <p className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            ✓ {success}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/15 transition hover:from-orange-600 hover:to-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Logging…" : "Log Maintenance"}
        </button>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-orange-500 focus:bg-white/10 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
        {label}
      </span>
      {children}
    </label>
  );
}
