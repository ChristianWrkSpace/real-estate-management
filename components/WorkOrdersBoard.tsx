"use client";

import { useState, useTransition } from "react";
import {
  assignVendorToOrder,
  createWorkOrder,
  resolveWorkOrder,
} from "@/app/actions/ops";
import DispatchSuggestionPanel from "@/components/DispatchSuggestionPanel";

export type WorkOrder = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  unit_id: string | null;
  vendor_id: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
};

export type Vendor = {
  id: string;
  name: string;
  trade: string | null;
};

export type Unit = { id: string; unit_number: string };

const COLUMNS: { key: string; label: string; accent: string }[] = [
  { key: "open", label: "Open", accent: "border-amber-400/30 bg-amber-500/5" },
  {
    key: "in_progress",
    label: "In Progress",
    accent: "border-blue-400/30 bg-blue-500/5",
  },
  {
    key: "resolved",
    label: "Resolved",
    accent: "border-emerald-400/30 bg-emerald-500/5",
  },
];

const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-red-500/20 text-red-200 border-red-400/30",
  medium: "bg-amber-500/20 text-amber-200 border-amber-400/30",
  low: "bg-white/10 text-white/70 border-white/20",
};

function priorityClass(p: string) {
  return PRIORITY_STYLE[p] ?? PRIORITY_STYLE.medium;
}

function groupByStatus(orders: WorkOrder[]) {
  const map: Record<string, WorkOrder[]> = { open: [], in_progress: [], resolved: [] };
  for (const o of orders) {
    const key = o.status === "completed" ? "resolved" : o.status;
    if (!map[key]) map[key] = [];
    map[key].push(o);
  }
  return map;
}

export default function WorkOrdersBoard({
  initialOrders,
  vendors,
  units,
}: {
  initialOrders: WorkOrder[];
  vendors: Vendor[];
  units: Unit[];
}) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const grouped = groupByStatus(initialOrders);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Work Orders</h1>
          <p className="mt-1 text-white/60">
            Dispatch vendors, track repairs, auto-log P&amp;L on resolve
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700"
        >
          + New Issue
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={`rounded-xl border ${col.accent} p-4 backdrop-blur-sm`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">
                {col.label}
              </h2>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                {(grouped[col.key] || []).length}
              </span>
            </div>

            <div className="space-y-3">
              {(grouped[col.key] || []).map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  vendors={vendors}
                  units={units}
                  onResolve={() => setResolvingId(order.id)}
                />
              ))}
              {(grouped[col.key] || []).length === 0 && (
                <p className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-white/30">
                  Empty
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {showNewModal && (
        <NewIssueModal
          units={units}
          onClose={() => setShowNewModal(false)}
        />
      )}

      {resolvingId && (
        <ResolveModal
          orderId={resolvingId}
          order={initialOrders.find((o) => o.id === resolvingId)}
          onClose={() => setResolvingId(null)}
        />
      )}
    </div>
  );
}

function OrderCard({
  order,
  vendors,
  units,
  onResolve,
}: {
  order: WorkOrder;
  vendors: Vendor[];
  units: Unit[];
  onResolve: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [vendorChoice, setVendorChoice] = useState(order.vendor_id ?? "");

  const unitLabel = units.find((u) => u.id === order.unit_id)?.unit_number;
  const vendorName = vendors.find((v) => v.id === order.vendor_id)?.name;
  const isResolved = order.status === "resolved" || order.status === "completed";

  const handleAssign = (vendorId: string) => {
    if (!vendorId || vendorId === order.vendor_id) return;
    setVendorChoice(vendorId);
    startTransition(async () => {
      await assignVendorToOrder(order.id, vendorId);
    });
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{order.title}</h3>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${priorityClass(
            order.priority
          )}`}
        >
          {order.priority}
        </span>
      </div>

      {order.description && (
        <p className="mb-3 line-clamp-2 text-xs text-white/60">{order.description}</p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
        {unitLabel && (
          <span className="rounded bg-white/10 px-2 py-0.5">Unit {unitLabel}</span>
        )}
        {order.estimated_cost != null && (
          <span className="rounded bg-white/10 px-2 py-0.5">
            Est ${Number(order.estimated_cost).toFixed(0)}
          </span>
        )}
        {order.actual_cost != null && (
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-200">
            Final ${Number(order.actual_cost).toFixed(2)}
          </span>
        )}
      </div>

      {!isResolved && (
        <div className="space-y-2">
          <select
            value={vendorChoice}
            onChange={(e) => handleAssign(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
          >
            <option value="">
              {vendorName ? `Assigned: ${vendorName}` : "— assign vendor —"}
            </option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id} className="bg-slate-900">
                {v.name}
                {v.trade ? ` (${v.trade})` : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onResolve}
            className="w-full rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            Mark as Resolved
          </button>

          {/* Argus-Dispatch — auto-suggest a vendor + cost estimate */}
          <DispatchSuggestionPanel
            workOrderId={order.id}
            isAlreadyAssigned={!!order.vendor_id}
          />
        </div>
      )}

      {isResolved && vendorName && (
        <p className="text-[11px] text-white/40">Resolved by {vendorName}</p>
      )}
    </div>
  );
}

function NewIssueModal({
  units,
  onClose,
}: {
  units: Unit[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    unitId: "",
    priority: "medium" as "low" | "medium" | "high",
    estimatedCost: "",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createWorkOrder({
        title: form.title,
        description: form.description,
        unitId: form.unitId || null,
        priority: form.priority,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
      });
      if (result.success) {
        onClose();
      } else {
        setError(result.error || "Failed to create work order");
      }
    });
  };

  return (
    <Modal onClose={onClose} title="New Issue">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., Unit 2 — water heater not heating"
            className={inputClass}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="What's happening, when did it start, tenant contact info…"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
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

          <Field label="Priority">
            <select
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: e.target.value as typeof form.priority })
              }
              className={inputClass}
            >
              <option value="low" className="bg-slate-900">Low</option>
              <option value="medium" className="bg-slate-900">Medium</option>
              <option value="high" className="bg-slate-900">High</option>
            </select>
          </Field>
        </div>

        <Field label="Estimated cost (optional)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.estimatedCost}
            onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
            placeholder="0.00"
            className={inputClass}
          />
        </Field>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white/80 transition hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResolveModal({
  orderId,
  order,
  onClose,
}: {
  orderId: string;
  order: WorkOrder | undefined;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState(
    order?.estimated_cost != null ? String(order.estimated_cost) : ""
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = Number(cost);
    if (!Number.isFinite(value) || value < 0) {
      setError("Enter a valid invoice amount (0 or more).");
      return;
    }
    startTransition(async () => {
      const result = await resolveWorkOrder(orderId, value);
      if (result.success) {
        onClose();
      } else {
        setError(result.error || "Failed to resolve");
      }
    });
  };

  return (
    <Modal onClose={onClose} title="Mark as Resolved">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-white/60">
          Enter the final invoice amount. This will be auto-logged as a maintenance
          expense in the P&amp;L.
        </p>

        <Field label="Final invoice amount (USD)">
          <input
            type="number"
            step="0.01"
            min="0"
            required
            autoFocus
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </Field>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white/80 transition hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {isPending ? "Resolving…" : "Resolve & Log Expense"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 transition focus:border-blue-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50";

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

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
