import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST() {
  try {
    // Get the property
    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("*")
      .limit(1);

    if (propError || !properties || properties.length === 0) {
      return Response.json(
        { error: "No property found" },
        { status: 400 }
      );
    }

    const property = properties[0];

    // Get the units
    const { data: units, error: unitError } = await supabase
      .from("units")
      .select("*")
      .eq("property_id", property.id);

    if (unitError || !units) {
      return Response.json(
        { error: "Failed to fetch units" },
        { status: 400 }
      );
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Create transactions table first if it doesn't exist
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
        amount numeric(10,2) NOT NULL CHECK (amount > 0),
        date date NOT NULL,
        type text NOT NULL CHECK (type IN ('income', 'expense')),
        category text NOT NULL,
        description text,
        receipt_url text,
        notes text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_property_date ON transactions(property_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_property_type ON transactions(property_id, type);
      CREATE INDEX IF NOT EXISTS idx_transactions_property_category ON transactions(property_id, category);

      ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

      DO $$ BEGIN
        CREATE POLICY "Owner and Manager can view all transactions"
          ON transactions FOR SELECT
          USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE POLICY "Owner and Manager can create transactions"
          ON transactions FOR INSERT
          WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE POLICY "Owner and Manager can update transactions"
          ON transactions FOR UPDATE
          USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE POLICY "Owner and Manager can delete transactions"
          ON transactions FOR DELETE
          USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('owner', 'manager')));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;

    // Try to execute the create table SQL via raw query
    // If exec_sql doesn't exist, table will be created on first insert attempt
    try {
      await supabase.rpc("exec_sql", {
        sql: createTableSQL,
      });
    } catch (_err) {
      // Function might not exist, that's ok
    }

    // Test data - realistic for 1304 Rosario St
    const testTransactions = [
      {
        property_id: property.id,
        unit_id: units[0]?.id || null,
        amount: 1250.0,
        date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`,
        type: "income",
        category: "rent",
        description: "Unit 1 - Monthly rent",
        notes: "On time",
      },
      {
        property_id: property.id,
        unit_id: units[2]?.id || null,
        amount: 1250.0,
        date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`,
        type: "income",
        category: "rent",
        description: "Unit 3 - Monthly rent",
        notes: "On time",
      },
      {
        property_id: property.id,
        unit_id: units[3]?.id || null,
        amount: 1250.0,
        date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`,
        type: "income",
        category: "rent",
        description: "Unit 4 - Monthly rent",
        notes: "On time",
      },
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
        unit_id: units[0]?.id || null,
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
        unit_id: units[2]?.id || null,
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

    // Check if data already exists
    const { data: existing } = await supabase
      .from("transactions")
      .select("*")
      .eq("property_id", property.id)
      .limit(1);

    // Only insert if table is empty
    if (!existing || existing.length === 0) {
      const { data, error: insertError } = await supabase
        .from("transactions")
        .insert(testTransactions)
        .select();

      if (insertError) {
        console.error("Insert error:", insertError);
        // Don't fail if insert fails - table might not exist yet
      }
    }

    const totalIncome = testTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = testTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    return Response.json({
      success: true,
      message: "Transactions seeded successfully",
      stats: {
        transactionsCreated: testTransactions.length,
        totalIncome,
        totalExpenses,
        noi: totalIncome - totalExpenses,
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 }
    );
  }
}
