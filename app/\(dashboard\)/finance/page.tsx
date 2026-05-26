"use client";

import { useState } from "react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getMonthSummary } from "@/app/actions/finance";
import { addTransaction } from "@/app/actions/finance";

export default function FinancePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    type: "expense" as "income" | "expense",
    category: "maintenance",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);

    // TODO: Implement transaction submission
    setTimeout(() => {
      setIsPending(false);
      setIsModalOpen(false);
      setFormData({
        amount: "",
        date: new Date().toISOString().split("T")[0],
        type: "expense",
        category: "maintenance",
        description: "",
      });
    }, 500);
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Finances</h1>
          <p className="mt-1 text-white/60">1304 Rosario St, Laredo TX • P&L Dashboard</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          + Add Transaction
        </button>
      </div>

      {/* Summary Cards - Placeholder for server-rendered data */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-8">
        {/* Total Income */}
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 backdrop-blur-xl">
          <p className="text-sm font-medium text-green-300/80">Total Income</p>
          <p className="mt-3 text-3xl font-bold text-green-300">$3,750</p>
          <p className="mt-2 text-xs text-green-300/60">3 transactions</p>
        </div>

        {/* Total Expenses */}
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 backdrop-blur-xl">
          <p className="text-sm font-medium text-red-300/80">Total Expenses</p>
          <p className="mt-3 text-3xl font-bold text-red-300">$2,280</p>
          <p className="mt-2 text-xs text-red-300/60">7 transactions</p>
        </div>

        {/* Net Operating Income */}
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-6 backdrop-blur-xl">
          <p className="text-sm font-medium text-blue-300/80">Net Operating Income</p>
          <p className="mt-3 text-3xl font-bold text-blue-300">+$1,470</p>
          <p className="mt-2 text-xs text-blue-300/60">Healthy cash flow</p>
        </div>
      </div>

      {/* Transactions Ledger */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/10 bg-white/[0.05]">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">
                  Description
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">
                  Category
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-white/80">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              <tr className="hover:bg-white/[0.05] transition">
                <td className="px-6 py-4 text-sm text-white/80">May 20</td>
                <td className="px-6 py-4 text-sm text-white/80">Property tax installment</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300">
                    property_tax
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-right text-red-300">
                  -$350.00
                </td>
              </tr>
              <tr className="hover:bg-white/[0.05] transition">
                <td className="px-6 py-4 text-sm text-white/80">May 15</td>
                <td className="px-6 py-4 text-sm text-white/80">Unit 3 - Pest control treatment</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300">
                    pest_control
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-right text-red-300">
                  -$75.00
                </td>
              </tr>
              <tr className="hover:bg-white/[0.05] transition">
                <td className="px-6 py-4 text-sm text-white/80">May 12</td>
                <td className="px-6 py-4 text-sm text-white/80">Landscaping service</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300">
                    maintenance
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-right text-red-300">
                  -$200.00
                </td>
              </tr>
              <tr className="hover:bg-white/[0.05] transition">
                <td className="px-6 py-4 text-sm text-white/80">May 10</td>
                <td className="px-6 py-4 text-sm text-white/80">Water bill</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300">
                    utilities
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-right text-red-300">
                  -$120.00
                </td>
              </tr>
              <tr className="hover:bg-white/[0.05] transition">
                <td className="px-6 py-4 text-sm text-white/80">May 08</td>
                <td className="px-6 py-4 text-sm text-white/80">Unit 1 - Faucet repair</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300">
                    maintenance
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-right text-red-300">
                  -$150.00
                </td>
              </tr>
              <tr className="hover:bg-white/[0.05] transition">
                <td className="px-6 py-4 text-sm text-white/80">May 07</td>
                <td className="px-6 py-4 text-sm text-white/80">Landlord insurance premium</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300">
                    insurance
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-right text-red-300">
                  -$185.00
                </td>
              </tr>
              <tr className="hover:bg-white/[0.05] transition">
                <td className="px-6 py-4 text-sm text-white/80">May 05</td>
                <td className="px-6 py-4 text-sm text-white/80">Monthly mortgage payment</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300">
                    mortgage
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-right text-red-300">
                  -$1,200.00
                </td>
              </tr>
              <tr className="hover:bg-white/[0.05] transition">
                <td className="px-6 py-4 text-sm text-white/80">May 01</td>
                <td className="px-6 py-4 text-sm text-white/80">Unit 4 - Monthly rent</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300">
                    rent
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-right text-green-300">
                  +$1,250.00
                </td>
              </tr>
              <tr className="hover:bg-white/[0.05] transition">
                <td className="px-6 py-4 text-sm text-white/80">May 01</td>
                <td className="px-6 py-4 text-sm text-white/80">Unit 3 - Monthly rent</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300">
                    rent
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-right text-green-300">
                  +$1,250.00
                </td>
              </tr>
              <tr className="hover:bg-white/[0.05] transition">
                <td className="px-6 py-4 text-sm text-white/80">May 01</td>
                <td className="px-6 py-4 text-sm text-white/80">Unit 1 - Monthly rent</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300">
                    rent
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-right text-green-300">
                  +$1,250.00
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">Add Transaction</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Type Selector */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-white/90">Type</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: "income" })}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
                      formData.type === "income"
                        ? "bg-green-500/30 border border-green-500/50 text-green-300"
                        : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    + Income
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: "expense" })}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
                      formData.type === "expense"
                        ? "bg-red-500/30 border border-red-500/50 text-red-300"
                        : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    - Expense
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-white/90">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 transition focus:border-blue-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-white/90">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white transition focus:border-blue-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-white/90">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white transition focus:border-blue-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                >
                  {formData.type === "income" ? (
                    <>
                      <option value="rent">Rent</option>
                      <option value="late_fees">Late Fees</option>
                      <option value="other_income">Other Income</option>
                    </>
                  ) : (
                    <>
                      <option value="maintenance">Maintenance</option>
                      <option value="mortgage">Mortgage</option>
                      <option value="insurance">Insurance</option>
                      <option value="utilities">Utilities</option>
                      <option value="property_tax">Property Tax</option>
                      <option value="pest_control">Pest Control</option>
                      <option value="landscaping">Landscaping</option>
                      <option value="management">Management</option>
                      <option value="other_expense">Other Expense</option>
                    </>
                  )}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-white/90">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Unit 1 - Faucet repair"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 transition focus:border-blue-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 py-3 px-4 font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-blue-600 py-3 px-4 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
