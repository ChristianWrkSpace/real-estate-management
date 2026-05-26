import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "contracts";

async function ensureBucket() {
  const { data: existing, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error("❌ listBuckets failed:", listErr.message);
    process.exit(1);
  }

  const found = existing?.find((b) => b.name === BUCKET);
  if (found) {
    console.log(`= bucket exists: ${BUCKET} (public=${found.public})`);
    // Ensure it's private
    if (found.public) {
      const { error } = await supabase.storage.updateBucket(BUCKET, {
        public: false,
        fileSizeLimit: 20 * 1024 * 1024,
        allowedMimeTypes: ["application/pdf", "image/*"],
      });
      if (error) console.error("⚠️ failed to set bucket private:", error.message);
      else console.log(`✅ ${BUCKET} set to private`);
    }
    return;
  }

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/*"],
  });

  if (error) {
    console.error(`❌ createBucket failed:`, error.message);
    process.exit(1);
  }
  console.log(`✅ created private bucket: ${BUCKET}`);
}

async function main() {
  console.log("🗄  Initializing storage…");
  await ensureBucket();

  console.log(`\n📋 RLS for storage.objects must be applied via SQL Editor (one-time).`);
  console.log(`   Open: https://supabase.com/dashboard/project/${(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace("https://", "").split(".")[0]}/sql/new`);
  console.log(`   Paste:\n`);
  console.log(`-- Owner-only read/write on contracts bucket
DO $$ BEGIN
  CREATE POLICY "Owner can read contracts"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'contracts'
      AND auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner can upload contracts"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'contracts'
      AND auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner can update contracts"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'contracts'
      AND auth.uid() IN (SELECT id FROM users WHERE role IN ('owner','manager'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner can delete contracts"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'contracts'
      AND auth.uid() IN (SELECT id FROM users WHERE role = 'owner')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`);

  console.log("\n✨ Storage init complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
