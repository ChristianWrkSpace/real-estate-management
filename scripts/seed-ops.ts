import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VENDORS = [
  {
    name: "Laredo HVAC Pros",
    trade: "HVAC",
    phone: "(956) 555-0142",
    email: "dispatch@laredohvacpros.com",
    billing_rate: 95,
  },
  {
    name: "Rosario St Plumbing",
    trade: "Plumbing",
    phone: "(956) 555-0188",
    email: "service@rosariostplumbing.com",
    billing_rate: 85,
  },
  {
    name: "Border Electric Co.",
    trade: "Electrical",
    phone: "(956) 555-0210",
    email: "ops@borderelectricco.com",
    billing_rate: 110,
  },
];

async function main() {
  console.log("🌱 Seeding ops data...");

  const { data: properties, error: propErr } = await supabase
    .from("properties")
    .select("id")
    .limit(1);
  if (propErr || !properties?.[0]) {
    console.error("❌ No property found:", propErr?.message);
    process.exit(1);
  }
  const propertyId = properties[0].id;

  const { data: units, error: unitErr } = await supabase
    .from("units")
    .select("id, unit_number")
    .eq("property_id", propertyId)
    .order("unit_number");
  if (unitErr) {
    console.error("❌ Failed to load units:", unitErr.message);
    process.exit(1);
  }
  const unit1 = units?.find((u) => u.unit_number === "1");
  const unit3 = units?.find((u) => u.unit_number === "3");

  // --- vendors (idempotent on name + property)
  for (const v of VENDORS) {
    const { data: existing } = await supabase
      .from("vendors")
      .select("id")
      .eq("property_id", propertyId)
      .eq("name", v.name)
      .maybeSingle();
    if (existing) {
      console.log(`= vendor exists: ${v.name}`);
      continue;
    }
    const { error } = await supabase
      .from("vendors")
      .insert({ ...v, property_id: propertyId });
    if (error) {
      console.error(`❌ failed to insert vendor ${v.name}:`, error.message);
    } else {
      console.log(`✅ inserted vendor: ${v.name}`);
    }
  }

  // --- work orders (skip if title already exists)
  const seedOrders = [
    {
      title: "Unit 1 AC capacitor blown",
      description:
        "Tenant reports no cold air since Saturday. Outdoor unit hums but compressor not engaging — likely run capacitor.",
      unit_id: unit1?.id || null,
      priority: "high",
      status: "open",
      estimated_cost: 180,
    },
    {
      title: "Unit 3 leaky kitchen sink",
      description:
        "Slow drip under sink P-trap. Pooling water in cabinet. Tenant placed a bucket — needs sealing and gasket replacement.",
      unit_id: unit3?.id || null,
      priority: "medium",
      status: "open",
      estimated_cost: 95,
    },
  ];

  for (const wo of seedOrders) {
    const { data: existing } = await supabase
      .from("work_orders")
      .select("id")
      .eq("property_id", propertyId)
      .eq("title", wo.title)
      .maybeSingle();
    if (existing) {
      console.log(`= work order exists: ${wo.title}`);
      continue;
    }
    const { error } = await supabase
      .from("work_orders")
      .insert({ ...wo, property_id: propertyId });
    if (error) {
      console.error(`❌ failed to insert work order ${wo.title}:`, error.message);
    } else {
      console.log(`✅ inserted work order: ${wo.title}`);
    }
  }

  console.log("\n✨ Ops seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
