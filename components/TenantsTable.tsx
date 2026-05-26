"use client";

import { useState } from "react";
import TenantEditDrawer, {
  type TenantDrawerData,
  type UnitOption,
} from "@/components/TenantEditDrawer";
import RentLinkButton from "@/components/RentLinkButton";
import LeasePdfUpload from "@/components/LeasePdfUpload";
import OnboardInviteButton from "@/components/OnboardInviteButton";
import EnforcementMenu from "@/components/EnforcementMenu";

export type TenantRow = TenantDrawerData & {
  existing_lease_url: string | null;
};

export default function TenantsTable({
  tenants,
  units,
}: {
  tenants: TenantRow[];
  units: UnitOption[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = tenants.find((t) => t.id === activeId) ?? null;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/80 shadow-xl">
        <table className="w-full">
          <thead className="border-b border-zinc-800 bg-zinc-900">
            <tr>
              <Th>Name</Th>
              <Th>Contact</Th>
              <Th>Status</Th>
              <Th align="right">Lease PDF</Th>
              <Th align="right">Onboarding</Th>
              <Th align="right">Rent Collection</Th>
              <Th align="right">Enforcement</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {tenants.map((t) => (
              <tr
                key={t.id}
                className="transition hover:bg-zinc-900/60"
              >
                <td className="px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setActiveId(t.id)}
                    className="text-left font-semibold tracking-tight text-zinc-100 transition hover:text-emerald-300"
                  >
                    {t.first_name} {t.last_name}
                    <span className="ml-1 text-[10px] font-normal text-zinc-500">
                      (edit)
                    </span>
                  </button>
                  {t.active_lease_unit_number && (
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      Unit {t.active_lease_unit_number}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-zinc-400">
                  <div>{t.email ?? "—"}</div>
                  <div className="text-xs text-zinc-500">{t.phone ?? "—"}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold capitalize text-emerald-300">
                    {t.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <LeasePdfUpload tenantId={t.id} existingUrl={t.existing_lease_url} />
                </td>
                <td className="px-6 py-4">
                  <OnboardInviteButton tenantId={t.id} />
                </td>
                <td className="px-6 py-4">
                  <RentLinkButton tenantId={t.id} />
                </td>
                <td className="px-6 py-4">
                  <EnforcementMenu
                    leaseId={t.active_lease_id}
                    isDelinquent={t.past_due_amount > 0}
                    pastDueAmount={t.past_due_amount}
                    unitNumber={t.active_lease_unit_number}
                  />
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-zinc-500">
                  No tenants yet. Add your first tenant to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TenantEditDrawer
        open={!!active}
        tenant={active}
        units={units}
        onClose={() => setActiveId(null)}
      />
    </>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
