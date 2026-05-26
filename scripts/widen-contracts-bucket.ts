import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await supabase.storage.updateBucket("contracts", {
    public: false,
    fileSizeLimit: 25 * 1024 * 1024,
    allowedMimeTypes: [
      "application/pdf",
      "image/*",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ],
  });
  if (error) {
    console.error("❌", error.message);
    process.exit(1);
  }
  console.log("✅ contracts bucket now accepts pdf, images, docx, and doc");
  process.exit(0);
}
main();
