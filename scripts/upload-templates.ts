/**
 * Uploads every .docx in TEMPLATES_DIR to the Supabase `contracts`
 * bucket under templates/, then registers each in contract_templates.
 * Idempotent — re-running upserts the file + row.
 */

import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const TEMPLATES_DIR =
  process.argv[2] || "/Users/andres/Downloads/Rental contracts ";

const BUCKET = "contracts";

type TemplateMeta = {
  kind: string;
  label: string;
  description: string;
};

function classifyFilename(filename: string): TemplateMeta {
  const lower = filename.toLowerCase();
  if (lower.includes("rental application")) {
    return {
      kind: "rental_application",
      label: "Rental Application",
      description:
        "Prospective tenant intake form. Used before a lease exists.",
    };
  }
  if (lower.includes("walk-through") || lower.includes("walkthrough") || lower.includes("walk through")) {
    return {
      kind: "walk_through",
      label: "Tenant Walk-Through Script (Bilingual)",
      description:
        "Move-in / move-out inspection checklist in English + Spanish.",
    };
  }
  if (lower.includes("full version")) {
    return {
      kind: "lease_full",
      label: "Residential Lease — Full Version",
      description:
        "Comprehensive Texas Property Code Ch. 92 residential lease.",
    };
  }
  if (lower.includes("short version")) {
    return {
      kind: "lease_short",
      label: "Residential Lease — Short Version",
      description:
        "Condensed Texas Property Code Ch. 92 residential lease.",
    };
  }
  // Fallback — derive kind from sanitized name
  return {
    kind: filename
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, ""),
    label: filename.replace(/\.[^.]+$/, ""),
    description: "Custom contract template.",
  };
}

function extractPlaceholders(docxBuffer: Buffer): string[] {
  // Pull text from word/document.xml inside the zip
  // Quick + dirty: scan the raw buffer for the bracket pattern. docx
  // stores strings as UTF-16 LE inside XML, but the surrounding XML is
  // ASCII so the brackets and uppercase text appear plainly in the
  // compressed-then-uncompressed text. We extract via JSZip for safety.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const JSZip = require("jszip");
  // Note: this is a sync wrapper around the async API for the script.
  // For a script it's fine; the real code uses async.
  return new Promise<string[]>((resolve) => {
    JSZip.loadAsync(docxBuffer).then((zip: any) => {
      zip
        .file("word/document.xml")
        ?.async("string")
        .then((xml: string) => {
          const plain = xml.replace(/<[^>]+>/g, " ");
          const matches = plain.match(/\[[A-Z][A-Z0-9 _#&,/]+\]/g) ?? [];
          resolve([...new Set(matches)]);
        })
        .catch(() => resolve([]));
    });
  }) as unknown as string[];
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.error(`❌ Templates dir not found: ${TEMPLATES_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".docx"));
  if (files.length === 0) {
    console.error(`❌ No .docx files in ${TEMPLATES_DIR}`);
    process.exit(1);
  }

  console.log(`📁 Found ${files.length} template(s) in ${TEMPLATES_DIR}`);

  for (const file of files) {
    const full = path.join(TEMPLATES_DIR, file);
    const buf = fs.readFileSync(full);
    const meta = classifyFilename(file);
    const storageKey = `templates/${meta.kind}.docx`;

    console.log(`\n→ ${meta.kind}  (${file}, ${(buf.length / 1024).toFixed(1)} KB)`);

    // Upload (upsert)
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storageKey, buf, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
    if (upErr) {
      console.error(`  ❌ upload: ${upErr.message}`);
      continue;
    }
    console.log(`  ✅ uploaded to ${storageKey}`);

    // Extract placeholders synchronously via promise wrapper
    const placeholders = await new Promise<string[]>((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const JSZip = require("jszip");
      JSZip.loadAsync(buf)
        .then((zip: any) =>
          zip.file("word/document.xml")?.async("string") ?? Promise.resolve(""),
        )
        .then((xml: string) => {
          const plain = xml.replace(/<[^>]+>/g, " ");
          const matches = plain.match(/\[[A-Z][A-Z0-9 _#&,/]+\]/g) ?? [];
          resolve([...new Set(matches)]);
        })
        .catch(() => resolve([]));
    });
    console.log(`  ✅ placeholders: ${placeholders.length} (${placeholders.slice(0, 5).join(", ")}${placeholders.length > 5 ? "…" : ""})`);

    // Upsert registry row
    const { error: regErr } = await supabase.from("contract_templates").upsert(
      {
        kind: meta.kind,
        label: meta.label,
        description: meta.description,
        storage_key: storageKey,
        file_extension: "docx",
        placeholders,
        active: true,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: "kind" }
    );
    if (regErr) {
      console.error(`  ❌ registry: ${regErr.message}`);
    } else {
      console.log(`  ✅ registered`);
    }
  }

  console.log("\n✨ Template upload complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
