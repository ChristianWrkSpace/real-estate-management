import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const MIGRATIONS = ["009_stripe_sync.sql", "010_operations.sql"];

async function applyViaPg(sql: string, file: string): Promise<boolean> {
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!url) return false;
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(sql);
    console.log(`✅ Applied ${file} via direct Postgres`);
    return true;
  } catch (err: any) {
    console.error(`❌ pg apply failed for ${file}:`, err.message);
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

async function applyViaSupabaseRpc(sql: string, file: string): Promise<boolean> {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await client.rpc("exec_sql", { sql });
  if (error) {
    console.error(`⚠️  Supabase RPC failed for ${file}:`, error.message);
    return false;
  }
  console.log(`✅ Applied ${file} via Supabase RPC`);
  return true;
}

async function main() {
  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .replace("https://", "")
    .split(".")[0];
  const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;
  const failures: string[] = [];

  for (const file of MIGRATIONS) {
    const fullPath = path.join(process.cwd(), "supabase", "migrations", file);
    const sql = fs.readFileSync(fullPath, "utf-8");
    console.log(`\n🔄 Applying ${file}...`);

    const okPg = await applyViaPg(sql, file);
    if (okPg) continue;

    const okRpc = await applyViaSupabaseRpc(sql, file);
    if (okRpc) continue;

    failures.push(file);
  }

  if (failures.length > 0) {
    console.log("\n" + "=".repeat(70));
    console.log("⚠️  AUTO-APPLY UNAVAILABLE — RUN THESE MANUALLY");
    console.log("=".repeat(70));
    console.log(`\nOpen: ${sqlEditorUrl}\n`);
    for (const f of failures) {
      const p = path.join(process.cwd(), "supabase", "migrations", f);
      console.log(`--- ${f} ---`);
      console.log(fs.readFileSync(p, "utf-8"));
      console.log("");
    }
    console.log("To skip this step in the future, set SUPABASE_DB_URL in .env.local:");
    console.log(`  SUPABASE_DB_URL=postgresql://postgres.${projectRef}:[DB_PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres\n`);
    process.exit(0);
  }

  console.log("\n✨ All migrations applied successfully.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
