import { createAdminClient } from "@/lib/supabase-server";
import { listContractTemplatesWithUrls } from "@/app/actions/contracts";
import ContractTemplateCard from "@/components/ContractTemplateCard";

export const dynamic = "force-dynamic";

type GeneratedDoc = {
  id: string;
  label: string;
  template_kind: string;
  storage_key: string;
  generated_at: string;
  signed_at: string | null;
  tenant_id: string;
  tenant_name: string | null;
  download_url: string | null;
};

export default async function ContractsPage() {
  const templates = await listContractTemplatesWithUrls();

  const admin = createAdminClient();
  const { data: rawDocs } = await admin
    .from("tenant_documents")
    .select("id, label, template_kind, storage_key, generated_at, signed_at, tenant_id")
    .order("generated_at", { ascending: false })
    .limit(50);

  const tenantIds = [...new Set((rawDocs ?? []).map((d) => d.tenant_id))];
  const { data: tenantsData } = await admin
    .from("tenants")
    .select("id, first_name, last_name")
    .in("id", tenantIds.length > 0 ? tenantIds : ["00000000-0000-0000-0000-000000000000"]);
  const tenantName = new Map(
    (tenantsData ?? []).map((t) => [t.id, `${t.first_name} ${t.last_name}`.trim()])
  );

  const generated: GeneratedDoc[] = await Promise.all(
    (rawDocs ?? []).map(async (d) => {
      const { data: signed } = await admin.storage
        .from("contracts")
        .createSignedUrl(d.storage_key, 60 * 60 * 24 * 7);
      return {
        id: d.id,
        label: d.label,
        template_kind: d.template_kind,
        storage_key: d.storage_key,
        generated_at: d.generated_at,
        signed_at: d.signed_at,
        tenant_id: d.tenant_id,
        tenant_name: tenantName.get(d.tenant_id) ?? null,
        download_url: signed?.signedUrl ?? null,
      };
    })
  );

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--fg)] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Contracts
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Master template library · click ✎ to edit label / description /
            availability, ⤒ to upload a new version of any template.
          </p>
        </header>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Template Library
            </h2>
            <span className="text-[11px] text-zinc-500">
              {templates.length} template{templates.length === 1 ? "" : "s"}
            </span>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-8 text-center text-sm text-zinc-500 shadow-xl">
              No templates registered. Drop .docx files into{" "}
              <code className="text-zinc-700 dark:text-zinc-300">~/Downloads/Rental contracts/</code>{" "}
              then run{" "}
              <code className="text-zinc-700 dark:text-zinc-300">
                npx tsx scripts/upload-templates.ts
              </code>
              .
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {templates.map((t) => (
                <ContractTemplateCard key={t.id} template={t} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Generated Contracts
            </h2>
            <span className="text-[11px] text-zinc-500">
              {generated.length} document{generated.length === 1 ? "" : "s"}
            </span>
          </div>

          {generated.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-8 text-center text-sm text-zinc-500 shadow-xl">
              Nothing generated yet. Open a tenant&apos;s drawer and use the
              Contract Library section to issue their first contract.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-xl">
              <table className="w-full">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
                  <tr>
                    <Th>Document</Th>
                    <Th>Tenant</Th>
                    <Th>Template</Th>
                    <Th>Generated</Th>
                    <Th>Signed</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {generated.map((d) => (
                    <tr key={d.id} className="transition hover:bg-zinc-900/60">
                      <td className="px-5 py-3 text-sm">
                        <p className="truncate text-zinc-900 dark:text-zinc-100" title={d.label}>
                          {d.label}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-700 dark:text-zinc-300">
                        {d.tenant_name ?? "—"}
                      </td>
                      <td className="px-5 py-3 font-mono text-[10px] text-zinc-500">
                        {d.template_kind}
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {new Date(d.generated_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {d.signed_at ? (
                          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                            ✓ {new Date(d.signed_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                            unsigned
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {d.download_url && (
                          <a
                            href={d.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-2 py-1 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-900"
                          >
                            open
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
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
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
