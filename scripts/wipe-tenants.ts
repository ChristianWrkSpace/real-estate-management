/**
 * Wipes all tenant-data so you can start with real data.
 *
 * Deletes (in FK order):
 *   contract_signing_requests, tenant_documents, rent_payments,
 *   work_orders, transactions, leases, tenants
 *
 * Resets all units → status = 'vacant'
 *
 * Keeps: properties, units (rows), vendors, contract_templates, ai_logs
 *
 *   npx tsx scripts/wipe-tenants.ts --confirm
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const CONFIRM = process.argv.includes("--confirm");

async function count(table: string): Promise<number> {
  const { count: c } = await db.from(table).select("*", { count: "exact", head: true });
  return c ?? 0;
}

async function main() {
  console.log("━".repeat(60));
  console.log("PropMan tenant wipe");
  console.log("━".repeat(60));

  const before = {
    tenants: await count("tenants"),
    leases: await count("leases"),
    signing: await count("contract_signing_requests"),
    documents: await count("tenant_documents"),
    rent: await count("rent_payments"),
    work_orders: await count("work_orders"),
    transactions: await count("transactions"),
  };
  console.log("\nWill delete:");
  for (const [k, v] of Object.entries(before)) {
    console.log(`  ${k.padEnd(15)} ${v} rows`);
  }
  console.log("\nWill preserve:");
  console.log(`  properties      ${await count("properties")} rows`);
  console.log(`  units           ${await count("units")} rows (status reset → vacant)`);
  console.log(`  vendors         ${await count("vendors")} rows`);
  console.log(`  contract_templates ${await count("contract_templates")} rows`);

  if (!CONFIRM) {
    console.log("\nDry run. Pass --confirm to execute.\n");
    process.exit(0);
  }

  console.log("\n→ Executing…");

  // FK order: children first
  const steps: { table: string; filter?: string }[] = [
    { table: "contract_signing_requests" },
    { table: "tenant_documents" },
    { table: "rent_payments" },
    { table: "work_orders" },
    { table: "transactions" },
    { table: "leases" },
    { table: "tenants" },
  ];

  for (const s of steps) {
    const c = await count(s.table);
    if (c === 0) {
      console.log(`  · ${s.table} already empty`);
      continue;
    }
    const { error } = await db
      .from(s.table)
      .delete()
      .gte("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      console.log(`  ✗ ${s.table}: ${error.message}`);
      process.exit(1);
    }
    const after = await count(s.table);
    console.log(`  ✓ ${s.table}: ${c} → ${after}`);
  }

  // Reset units
  const { error: uErr } = await db
    .from("units")
    .update({ status: "vacant" })
    .gte("id", "00000000-0000-0000-0000-000000000000");
  if (uErr) {
    console.log(`  ✗ units: ${uErr.message}`);
    process.exit(1);
  }
  console.log("  ✓ units: all set to vacant");

  console.log("\n━".repeat(30));
  console.log("Wipe complete. Re-run probe to verify:");
  console.log("  npx tsx scripts/_quick-state.ts");
  console.log("━".repeat(30) + "\n");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
