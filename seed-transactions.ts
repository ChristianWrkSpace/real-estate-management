import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log("🔄 Running migration 002_transactions.sql...");

  const migrationPath = path.join(
    process.cwd(),
    "supabase/migrations/002_transactions.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf-8");

  const { error } = await supabase.rpc("exec", { sql });

  if (error) {
    console.log(
      "⚠️  Migration already exists or DB updated (this is fine):",
      error.message
    );
  } else {
    console.log("✅ Migration executed successfully");
  }
}

async function seedTransactions() {
  console.log("🌱 Seeding realistic transaction data...");

  // Get the property
  const { data: properties, error: propError } = await supabase
    .from("properties")
    .select("*")
    .limit(1);

  if (propError || !properties || properties.length === 0) {
    console.error("❌ No property found");
    return;
  }

  const property = properties[0];

  // Get the units
  const { data: units, error: unitError } = await supabase
    .from("units")
    .select("*")
    .eq("property_id", property.id);

  if (unitError || !units) {
    console.error("❌ Failed to fetch units");
    return;
  }

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Realistic test data for May 2026
  const testTransactions = [
    // Rent income (3 units occupied at $1,250 each)
    {
      property_id: property.id,
      unit_id: units[0]?.id,
      amount: 1250.0,
      date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`,
      type: "income",
      category: "rent",
      description: "Unit 1 - Monthly rent",
      notes: "On time",
    },
    {
      property_id: property.id,
      unit_id: units[2]?.id,
      amount: 1250.0,
      date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`,
      type: "income",
      category: "rent",
      description: "Unit 3 - Monthly rent",
      notes: "On time",
    },
    {
      property_id: property.id,
      unit_id: units[3]?.id,
      amount: 1250.0,
      date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`,
      type: "income",
      category: "rent",
      description: "Unit 4 - Monthly rent",
      notes: "On time",
    },

    // Expenses
    {
      property_id: property.id,
      unit_id: null,
      amount: 1200.0,
      date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-05`,
      type: "expense",
      category: "mortgage",
      description: "Monthly mortgage payment",
      notes: "Principal + Interest",
    },
    {
      property_id: property.id,
      unit_id: null,
      amount: 185.0,
      date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-07`,
      type: "expense",
      category: "insurance",
      description: "Landlord insurance premium",
      notes: "Monthly",
    },
    {
      property_id: property.id,
      unit_id: units[0]?.id,
      amount: 150.0,
      date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-08`,
      type: "expense",
      category: "maintenance",
      description: "Unit 1 - Faucet repair",
      notes: "Kitchen sink leak",
    },
    {
      property_id: property.id,
      unit_id: null,
      amount: 120.0,
      date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-10`,
      type: "expense",
      category: "utilities",
      description: "Water bill",
      notes: "Common area",
    },
    {
      property_id: property.id,
      unit_id: null,
      amount: 200.0,
      date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-12`,
      type: "expense",
      category: "maintenance",
      description: "Landscaping service",
      notes: "Monthly lawn care",
    },
    {
      property_id: property.id,
      unit_id: units[2]?.id,
      amount: 75.0,
      date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-15`,
      type: "expense",
      category: "pest_control",
      description: "Unit 3 - Pest control treatment",
      notes: "Quarterly service",
    },
    {
      property_id: property.id,
      unit_id: null,
      amount: 350.0,
      date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-20`,
      type: "expense",
      category: "property_tax",
      description: "Property tax installment",
      notes: "Laredo, TX",
    },
  ];

  const { data, error } = await supabase
    .from("transactions")
    .insert(testTransactions)
    .select();

  if (error) {
    console.error("❌ Failed to seed transactions:", error.message);
    return;
  }

  console.log(`✅ Seeded ${data?.length || 0} transactions`);
  console.log(
    `💰 Total Income: $${testTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0)}`
  );
  console.log(
    `💸 Total Expenses: $${testTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0)}`
  );
}

async function main() {
  console.log("🚀 Starting PropMan OS seed process...\n");

  try {
    await runMigration();
    await seedTransactions();
    console.log(
      "\n✨ Seed complete! Your dashboard is ready with realistic test data."
    );
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  }
}

main();
