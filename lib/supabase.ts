import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client — use in Client Components only.
// Server-only helpers (createServerSupabaseClient, createAdminClient) live in lib/supabase-server.ts.
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
