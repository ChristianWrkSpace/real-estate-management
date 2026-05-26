import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TABLES_AND_COLUMNS: Record<string, string[]> = {
  transactions: ["id", "property_id", "unit_id", "amount", "date", "type", "category", "description"],
  vendors: ["id", "property_id", "name", "trade", "phone", "email", "billing_rate", "notes", "created_at"],
  work_orders: [
    "id",
    "property_id",
    "unit_id",
    "tenant_id",
    "vendor_id",
    "contractor_id",
    "title",
    "description",
    "category",
    "priority",
    "status",
    "estimated_cost",
    "actual_cost",
    "scheduled_at",
    "completed_at",
    "created_at",
  ],
  ai_logs: ["id", "agent_name", "task_description", "model_used", "token_cost", "status", "output_data"],
};

async function probeColumns() {
  for (const [table, cols] of Object.entries(TABLES_AND_COLUMNS)) {
    console.log(`\n── ${table} ──`);
    const present: string[] = [];
    const missing: string[] = [];
    let tableMissing = false;
    for (const col of cols) {
      const { error } = await supabase.from(table).select(col).limit(0);
      if (!error) {
        present.push(col);
      } else if (/column .* does not exist/i.test(error.message)) {
        missing.push(col);
      } else if (/(relation|table).* does not exist|schema cache/i.test(error.message)) {
        console.log(`  ⛔ table missing or cache stale: ${error.message}`);
        tableMissing = true;
        break;
      } else {
        console.log(`  ⚠ ${col}: ${error.message}`);
      }
    }
    if (!tableMissing) {
      console.log(`  present (${present.length}): ${present.join(", ") || "(none)"}`);
      console.log(`  missing (${missing.length}): ${missing.join(", ") || "(none)"}`);
    }
  }
}

probeColumns()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  });
