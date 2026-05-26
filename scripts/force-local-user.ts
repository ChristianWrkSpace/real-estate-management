/**
 * Force-create or reset the admin@propman.com user so you can log in
 * without going through the rate-limited signup flow.
 *
 * Idempotent:
 *   - If the auth.users row exists, the password is reset (no rate limit).
 *   - If not, it's created via the admin API with email_confirm=true so
 *     no email confirmation step is needed.
 *   - The public.users profile row is upserted to role='owner'.
 *
 * Usage:
 *   npx tsx scripts/force-local-user.ts
 *   npx tsx scripts/force-local-user.ts --email you@example.com --password 'Custom123!'
 */

import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Supabase env vars missing in .env.local");
  process.exit(1);
}

type Args = { email: string; password: string; name: string };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = {
    email: "admin@propman.com",
    password: "AdminTest123!",
    name: "Admin Owner",
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === "--email" && v) {
      out.email = v;
      i++;
    } else if (k === "--password" && v) {
      out.password = v;
      i++;
    } else if (k === "--name" && v) {
      out.name = v;
      i++;
    }
  }
  return out;
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { email, password, name } = parseArgs();

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log(`🔑 Force-provisioning ${email}…`);

  // ── 1. Find or create the auth.users row ────────────────────────────────
  let userId: string | null = null;

  // listUsers paginates, so we walk pages until we find the match (or hit the end)
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error(`❌ listUsers page ${page} failed:`, error.message);
      process.exit(1);
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      userId = match.id;
      break;
    }
    if (data.users.length < 200) break; // no more pages
  }

  if (userId) {
    console.log(`= auth.users row exists (${userId}) — resetting password + confirming email`);
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error) {
      console.error(`❌ updateUserById failed:`, error.message);
      process.exit(1);
    }
  } else {
    console.log("✚ creating auth.users row");
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error || !data.user) {
      console.error(`❌ createUser failed:`, error?.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log(`✅ created (${userId})`);
  }

  // ── 2. Upsert the public.users profile with owner role ─────────────────
  const { error: upsertErr } = await admin
    .from("users")
    .upsert(
      { id: userId, email, name, role: "owner" },
      { onConflict: "id" }
    );

  if (upsertErr) {
    console.error(`⚠ public.users upsert failed:`, upsertErr.message);
    // Not fatal — getCurrentUser() in lib/auth-helpers will auto-create the
    // profile on first login. But let the operator know.
  } else {
    console.log(`✅ public.users upserted (role=owner)`);
  }

  console.log("\n──────────────── READY TO LOG IN ────────────────");
  console.log(`  URL:      ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Role:     owner`);
  console.log("─────────────────────────────────────────────────\n");

  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
