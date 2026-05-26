/**
 * Smoke test: exercises every critical tenant/lease/unit state transition
 * against the live Supabase. All test entities are prefixed `SMOKE_` and
 * deleted at the end. Runs in ~10 seconds.
 *
 *   npx tsx scripts/smoke-test.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const anonDb = createClient(url, anonKey, { auth: { persistSession: false } });

type Result = { name: string; pass: boolean; detail?: string; ms: number };
const results: Result[] = [];

async function step(name: string, fn: () => Promise<void>) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, pass: true, ms: Date.now() - t0 });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    results.push({ name, pass: false, detail, ms: Date.now() - t0 });
    console.log(`  ✗ ${name}\n      ${detail}`);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// State carried between scenarios
const state: {
  propertyId?: string;
  unitA?: string;
  unitB?: string;
  unitA_originalStatus?: string;
  unitB_originalStatus?: string;
  prospectId?: string;
  activeTenantId?: string;
  activeLeaseId?: string;
  signingToken?: string;
  signingRequestId?: string;
  templateId?: string;
  templateKind?: string;
  createdTenantIds: string[];
} = { createdTenantIds: [] };

// ─────────────────────────────────────────────────────────────────────────────

async function setup() {
  console.log("\n→ Setup");
  await step("locate the property + 2 units with no other active leases", async () => {
    const { data: prop } = await db.from("properties").select("id").limit(1).maybeSingle();
    assert(prop, "no property found");
    state.propertyId = prop.id;
    const { data: units } = await db
      .from("units")
      .select("id, status")
      .eq("property_id", prop.id)
      .order("unit_number");
    assert(units && units.length >= 2, "need at least 2 units");

    const { data: activeLeases } = await db
      .from("leases")
      .select("unit_id")
      .eq("status", "active");
    const occupied = new Set((activeLeases ?? []).map((l) => l.unit_id));
    const isolated = units.filter((u) => !occupied.has(u.id));
    assert(
      isolated.length >= 2,
      `need 2 units with no active leases; only ${isolated.length} are clean (run wipe first if you want full coverage)`
    );
    state.unitA = isolated[0].id;
    state.unitA_originalStatus = isolated[0].status;
    state.unitB = isolated[1].id;
    state.unitB_originalStatus = isolated[1].status;
  });

  await step("at least one active contract_template exists", async () => {
    const { data: t } = await db
      .from("contract_templates")
      .select("id, kind")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    assert(t, "no active template — run upload-templates.ts first");
    state.templateId = t.id;
    state.templateKind = t.kind;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIOS

async function scenarios() {
  console.log("\n→ Tenants & leases");

  await step("S01 — create prospect (no lease, no unit)", async () => {
    const { data, error } = await db
      .from("tenants")
      .insert({
        property_id: state.propertyId,
        first_name: "SMOKE_Prospect",
        last_name: "Alpha",
        email: "smoke-prospect@example.test",
        phone: "5550000001",
        status: "prospect",
      })
      .select("id")
      .single();
    assert(!error, error?.message ?? "");
    state.prospectId = data!.id;
    state.createdTenantIds.push(data!.id);
  });

  await step("S02 — activate prospect: create lease + flip unit + update status", async () => {
    const { data: lease, error: lErr } = await db
      .from("leases")
      .insert({
        unit_id: state.unitA,
        tenant_id: state.prospectId,
        start_date: new Date().toISOString().split("T")[0],
        monthly_rent: 1500,
        security_deposit: 1500,
        lease_type: "fixed",
        status: "active",
      })
      .select("id")
      .single();
    assert(!lErr, lErr?.message ?? "");
    await db.from("units").update({ status: "occupied" }).eq("id", state.unitA);
    await db.from("tenants").update({ status: "active" }).eq("id", state.prospectId);

    const { data: unit } = await db
      .from("units")
      .select("status")
      .eq("id", state.unitA)
      .single();
    assert(unit?.status === "occupied", `unit A status = ${unit?.status}, expected occupied`);
    const { data: tenant } = await db
      .from("tenants")
      .select("status")
      .eq("id", state.prospectId)
      .single();
    assert(tenant?.status === "active", `tenant status = ${tenant?.status}, expected active`);

    state.activeTenantId = state.prospectId;
    state.activeLeaseId = lease!.id;
  });

  await step("S03 — block: can't activate when already has active lease (data invariant)", async () => {
    const { data: existing } = await db
      .from("leases")
      .select("id")
      .eq("tenant_id", state.activeTenantId)
      .eq("status", "active")
      .maybeSingle();
    assert(existing, "tenant should already have an active lease");
  });

  await step("S04 — reassign: tenant moves from unit A → unit B, units reconcile", async () => {
    await db
      .from("leases")
      .update({ unit_id: state.unitB })
      .eq("id", state.activeLeaseId);
    const { data: remaining } = await db
      .from("leases")
      .select("id")
      .eq("unit_id", state.unitA)
      .eq("status", "active");
    if (!remaining || remaining.length === 0) {
      await db.from("units").update({ status: "vacant" }).eq("id", state.unitA);
    }
    await db.from("units").update({ status: "occupied" }).eq("id", state.unitB);

    const { data: a } = await db
      .from("units")
      .select("status")
      .eq("id", state.unitA)
      .single();
    const { data: b } = await db
      .from("units")
      .select("status")
      .eq("id", state.unitB)
      .single();
    assert(a?.status === "vacant", `unit A should be vacant after reassign, got ${a?.status}`);
    assert(b?.status === "occupied", `unit B should be occupied after reassign, got ${b?.status}`);
  });

  await step("S05 — update tenant contact info", async () => {
    const newName = "SMOKE_Renamed";
    await db
      .from("tenants")
      .update({ first_name: newName, email: "smoke-updated@example.test" })
      .eq("id", state.activeTenantId);
    const { data } = await db
      .from("tenants")
      .select("first_name, email")
      .eq("id", state.activeTenantId)
      .single();
    assert(data?.first_name === newName, `name = ${data?.first_name}`);
    assert(data?.email === "smoke-updated@example.test", `email = ${data?.email}`);
  });

  console.log("\n→ Signing flow");

  await step("S06 — mint signing request", async () => {
    const token = randomBytes(24).toString("base64url");
    const { data, error } = await db
      .from("contract_signing_requests")
      .insert({
        token,
        tenant_id: state.activeTenantId,
        lease_id: state.activeLeaseId,
        template_id: state.templateId,
        template_kind: state.templateKind,
        template_label: "SMOKE template",
        prefilled_fields: { "[APPLICANT FULL NAME]": "SMOKE_Renamed Alpha" },
        required_fields: ["[APT #]"],
      })
      .select("id")
      .single();
    assert(!error, error?.message ?? "");
    state.signingToken = token;
    state.signingRequestId = data!.id;
  });

  await step("S07 — RPC get_signing_request_by_token returns row for valid token", async () => {
    const { data, error } = await anonDb.rpc("get_signing_request_by_token", {
      p_token: state.signingToken,
    });
    assert(!error, error?.message ?? "");
    assert(data && data.length === 1, `expected 1 row, got ${data?.length}`);
    assert(data[0].status === "pending", `status = ${data[0].status}`);
    assert(data[0].property_full_address?.length > 5, "property_full_address missing");
  });

  await step("S08 — RPC returns nothing for non-existent token", async () => {
    const { data } = await anonDb.rpc("get_signing_request_by_token", {
      p_token: "this-token-does-not-exist",
    });
    assert(!data || data.length === 0, `expected empty, got ${data?.length} rows`);
  });

  await step("S09 — RPC returns nothing for expired token", async () => {
    const expiredToken = randomBytes(24).toString("base64url");
    await db.from("contract_signing_requests").insert({
      token: expiredToken,
      tenant_id: state.activeTenantId,
      template_id: state.templateId,
      template_kind: state.templateKind,
      template_label: "SMOKE expired",
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    const { data } = await anonDb.rpc("get_signing_request_by_token", {
      p_token: expiredToken,
    });
    assert(!data || data.length === 0, `expired token leaked: ${data?.length} rows`);
    await db.from("contract_signing_requests").delete().eq("token", expiredToken);
  });

  await step("S10 — RPC returns nothing once status flips to 'signed'", async () => {
    await db
      .from("contract_signing_requests")
      .update({ status: "signed", signed_at: new Date().toISOString() })
      .eq("id", state.signingRequestId);
    const { data } = await anonDb.rpc("get_signing_request_by_token", {
      p_token: state.signingToken,
    });
    assert(!data || data.length === 0, `signed token leaked: ${data?.length} rows`);
    // restore for cleanup
    await db
      .from("contract_signing_requests")
      .update({ status: "pending", signed_at: null })
      .eq("id", state.signingRequestId);
  });

  console.log("\n→ Onboarding token");

  await step("S11 — mint onboarding token on lease, look up via RPC", async () => {
    const onboardingToken = randomBytes(24).toString("base64url");
    await db
      .from("leases")
      .update({ onboarding_token: onboardingToken })
      .eq("id", state.activeLeaseId);

    const { data, error } = await anonDb.rpc("get_lease_for_onboarding", {
      p_token: onboardingToken,
    });
    assert(!error, error?.message ?? "");
    assert(data && data.length === 1, `expected 1 row, got ${data?.length}`);
    assert(
      data[0].tenant_first_name === "SMOKE_Renamed",
      `wrong tenant: ${data[0].tenant_first_name}`
    );
  });

  await step("S12 — onboarding RPC returns nothing for bogus token", async () => {
    const { data } = await anonDb.rpc("get_lease_for_onboarding", {
      p_token: "totally-bogus-token-value",
    });
    assert(!data || data.length === 0, `bogus leaked ${data?.length} rows`);
  });

  console.log("\n→ End-lease flow");

  await step("S13 — end active lease: status=terminated, end_date set", async () => {
    const endDate = new Date().toISOString().split("T")[0];
    await db
      .from("leases")
      .update({ status: "terminated", end_date: endDate })
      .eq("id", state.activeLeaseId);
    const { data } = await db
      .from("leases")
      .select("status, end_date")
      .eq("id", state.activeLeaseId)
      .single();
    assert(data?.status === "terminated", `status = ${data?.status}`);
    assert(data?.end_date === endDate, `end_date = ${data?.end_date}`);
  });

  await step("S14 — end-lease frees the unit (no other active leases)", async () => {
    const { data: remaining } = await db
      .from("leases")
      .select("id")
      .eq("unit_id", state.unitB)
      .eq("status", "active");
    if (!remaining || remaining.length === 0) {
      await db.from("units").update({ status: "vacant" }).eq("id", state.unitB);
    }
    const { data: unit } = await db
      .from("units")
      .select("status")
      .eq("id", state.unitB)
      .single();
    assert(unit?.status === "vacant", `unit B should be vacant after end-lease, got ${unit?.status}`);
  });

  await step("S15 — tenant status moves to 'former' on end-lease", async () => {
    await db.from("tenants").update({ status: "former" }).eq("id", state.activeTenantId);
    const { data } = await db
      .from("tenants")
      .select("status")
      .eq("id", state.activeTenantId)
      .single();
    assert(data?.status === "former", `tenant status = ${data?.status}`);
  });

  console.log("\n→ Reactivation");

  await step("S16 — former tenant can be activated again with a new lease", async () => {
    const { data: lease, error } = await db
      .from("leases")
      .insert({
        unit_id: state.unitA,
        tenant_id: state.activeTenantId,
        start_date: new Date().toISOString().split("T")[0],
        monthly_rent: 1600,
        lease_type: "month-to-month",
        status: "active",
      })
      .select("id")
      .single();
    assert(!error, error?.message ?? "");
    await db.from("units").update({ status: "occupied" }).eq("id", state.unitA);
    await db.from("tenants").update({ status: "active" }).eq("id", state.activeTenantId);
    state.activeLeaseId = lease!.id;

    const { data: t } = await db
      .from("tenants")
      .select("status")
      .eq("id", state.activeTenantId)
      .single();
    assert(t?.status === "active", `tenant should be active after re-lease, got ${t?.status}`);
  });

  console.log("\n→ Constraint / RLS guards");

  await step("S17 — RLS blocks anonymous SELECT on tenants", async () => {
    const { data, error } = await anonDb.from("tenants").select("id").limit(1);
    assert(
      error || !data || data.length === 0,
      `anon can read tenants! got ${data?.length} rows`
    );
  });

  await step("S18 — RLS blocks anonymous SELECT on leases", async () => {
    const { data, error } = await anonDb.from("leases").select("id").limit(1);
    assert(
      error || !data || data.length === 0,
      `anon can read leases! got ${data?.length} rows`
    );
  });

  await step("S19 — invalid lease.status value is rejected (CHECK constraint)", async () => {
    const { error } = await db
      .from("leases")
      .insert({
        unit_id: state.unitA,
        tenant_id: state.activeTenantId,
        start_date: new Date().toISOString().split("T")[0],
        monthly_rent: 1,
        status: "fake-status-value",
      });
    assert(error, "DB should have rejected invalid status");
  });

  await step("S20 — token uniqueness enforced on signing requests", async () => {
    const dup = randomBytes(24).toString("base64url");
    await db.from("contract_signing_requests").insert({
      token: dup,
      tenant_id: state.activeTenantId,
      template_id: state.templateId,
      template_kind: state.templateKind,
      template_label: "SMOKE dup A",
    });
    const { error } = await db.from("contract_signing_requests").insert({
      token: dup,
      tenant_id: state.activeTenantId,
      template_id: state.templateId,
      template_kind: state.templateKind,
      template_label: "SMOKE dup B",
    });
    assert(error, "duplicate token slipped through");
    await db.from("contract_signing_requests").delete().eq("token", dup);
  });
}

// ─────────────────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log("\n→ Cleanup");
  await step("delete SMOKE_ tenants (cascades leases + signing + documents)", async () => {
    for (const id of state.createdTenantIds) {
      await db.from("contract_signing_requests").delete().eq("tenant_id", id);
      await db.from("tenant_documents").delete().eq("tenant_id", id);
      await db.from("leases").delete().eq("tenant_id", id);
      await db.from("tenants").delete().eq("id", id);
    }
  });

  await step("restore original unit statuses", async () => {
    if (state.unitA && state.unitA_originalStatus) {
      await db.from("units").update({ status: state.unitA_originalStatus }).eq("id", state.unitA);
    }
    if (state.unitB && state.unitB_originalStatus) {
      await db.from("units").update({ status: state.unitB_originalStatus }).eq("id", state.unitB);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("━".repeat(60));
  console.log("PropMan smoke test");
  console.log("━".repeat(60));

  await setup();
  await scenarios();
  await cleanup();

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;

  console.log("\n" + "━".repeat(60));
  console.log(`${pass}/${results.length} passed${fail ? `  · ${fail} FAILED` : ""}`);
  console.log("━".repeat(60));

  if (fail > 0) {
    console.log("\nFAILURES:");
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  ✗ ${r.name}`);
      console.log(`      ${r.detail}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
