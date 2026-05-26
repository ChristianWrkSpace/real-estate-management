"use client";

import { useState, useTransition } from "react";
import { addTransaction } from "@/app/actions/finance";

type Unit = { id: string; unit_number: string };

export default function AddTransactionModal({
  propertyId,
  units,
}: {
  propertyId: string | null;
  units: Unit[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    type: "expense" as "income" | "expense",
    category: "maintenance",
    unitId: "",
    description: "",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!propertyId) {
      setError("No property loaded.");
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    startTransition(async () => {
      const r = await addTransaction({
        propertyId,
        unitId: form.unitId || null,
        amount,
        date: form.date,
        type: form.type,
        category: form.category,
        description: form.description || undefined,
      });
      if (r.success) {
        setIsOpen(false);
        setForm({
          amount: "",
          date: new Date().toISOString().split("T")[0],
          type: "expense",
          category: "maintenance",
          unitId: "",
          description: "",
        });
        // Reload to refresh server data; cheaper than wiring revalidate hooks.
        if (typeof window !== "undefined") window.location.reload();
      } else {
        setError(r.error || "Insert failed");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700"
      >
        + Add Transaction
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-white/10 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Add Transaction</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded p-1 text-zinc-500 dark:text-white/50 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, type: "income", category: "rent" })
                  }
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    form.type === "income"
                      ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                      : "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-white/60 hover:bg-white/10"
                  }`}
                >
                  + Income
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, type: "expense", category: "maintenance" })
                  }
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    form.type === "expense"
                      ? "border-rose-400/50 bg-rose-500/20 text-rose-200"
                      : "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-white/60 hover:bg-white/10"
                  }`}
                >
                  − Expense
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    className={inputClass}
                  />
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Unit (optional)">
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

              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={inputClass}
                >
                  {form.type === "income" ? (
                    <>
                      <option value="rent" className="bg-slate-900">Rent</option>
                      <option value="late_fees" className="bg-slate-900">Late Fees</option>
                      <option value="other_income" className="bg-slate-900">Other Income</option>
                    </>
                  ) : (
                    <>
                      <option value="maintenance" className="bg-slate-900">Maintenance</option>
                      <option value="mortgage_interest" className="bg-slate-900">Mortgage Interest</option>
                      <option value="mortgage_principal" className="bg-slate-900">Mortgage Principal</option>
                      <option value="insurance" className="bg-slate-900">Insurance</option>
                      <option value="utilities" className="bg-slate-900">Utilities</option>
                      <option value="property_tax" className="bg-slate-900">Property Tax</option>
                      <option value="pest_control" className="bg-slate-900">Pest Control</option>
                      <option value="landscaping" className="bg-slate-900">Landscaping</option>
                      <option value="management" className="bg-slate-900">Management</option>
                      <option value="other_expense" className="bg-slate-900">Other</option>
                    </>
                  )}
                </select>
              </Field>

              <Field label="Description">
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g., Unit 1 — Faucet repair"
                  className={inputClass}
                />
              </Field>

              {error && (
                <p className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  ⚠ {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 px-4 py-2 font-semibold text-zinc-700 dark:text-white/80 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? "Adding…" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-white/40 focus:border-blue-500 focus:bg-white/10 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-white/70">
        {label}
      </span>
      {children}
    </label>
  );
}
