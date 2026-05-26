import { createServerSupabaseClient } from "@/lib/supabase-server";
import RentLinkButton from "@/components/RentLinkButton";
import LeasePdfUpload from "@/components/LeasePdfUpload";
import OnboardInviteButton from "@/components/OnboardInviteButton";
import EnforcementMenu from "@/components/EnforcementMenu";
import { getLeaseDocumentMap } from "@/app/actions/leases";
import { getDelinquencyMap } from "@/app/actions/legal";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: properties } = await supabase.from("properties").select("*").limit(1);
  const property = properties?.[0];

  const { data: tenants = [] } = await supabase
    .from("tenants")
    .select("*")
    .eq("property_id", property?.id || "");

  const tenantList = tenants ?? [];
  const [leaseDocs, delinquency] = await Promise.all([
    getLeaseDocumentMap(tenantList.map((t) => t.id)),
    getDelinquencyMap(),
  ]);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Tenants</h1>
          <p className="mt-1 text-white/60">
            One-click rent collection · drag-and-drop lease vault
          </p>
        </div>
        <a
          href="#"
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
        >
          + Add Tenant
        </a>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
        <table className="w-full">
          <thead className="border-b border-white/10 bg-white/[0.05]">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Contact</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Status</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-white/80">
                Lease PDF
              </th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-white/80">
                Onboarding
              </th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-white/80">
                Rent Collection
              </th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-white/80">
                Enforcement
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {tenantList.map((tenant) => (
              <tr key={tenant.id} className="transition hover:bg-white/[0.05]">
                <td className="px-6 py-4">
                  <a
                    href={`/tenants/${tenant.id}`}
                    className="font-semibold text-white transition hover:text-blue-400"
                  >
                    {tenant.first_name} {tenant.last_name}
                  </a>
                </td>
                <td className="px-6 py-4 text-sm text-white/60">
                  <div>{tenant.email}</div>
                  <div className="text-xs text-white/40">{tenant.phone}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold capitalize text-green-300">
                    {tenant.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <LeasePdfUpload
                    tenantId={tenant.id}
                    existingUrl={leaseDocs[tenant.id] ?? null}
                  />
                </td>
                <td className="px-6 py-4">
                  <OnboardInviteButton tenantId={tenant.id} />
                </td>
                <td className="px-6 py-4">
                  <RentLinkButton tenantId={tenant.id} />
                </td>
                <td className="px-6 py-4">
                  <EnforcementMenu
                    leaseId={delinquency[tenant.id]?.lease_id ?? null}
                    isDelinquent={delinquency[tenant.id]?.is_delinquent ?? false}
                    pastDueAmount={delinquency[tenant.id]?.past_due_amount ?? 0}
                    unitNumber={delinquency[tenant.id]?.unit_number ?? null}
                  />
                </td>
              </tr>
            ))}
            {tenantList.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-white/40">
                  No tenants yet. Add your first tenant to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
