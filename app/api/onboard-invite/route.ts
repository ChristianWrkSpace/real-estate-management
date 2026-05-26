import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createOnboardingInvite } from "@/app/actions/onboarding";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenantId");
  if (!tenantId) {
    return Response.json({ error: "tenantId is required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  // Auth gate — only owner/manager can mint invites
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || (profile.role !== "owner" && profile.role !== "manager")) {
    return Response.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Find the active (or pending) lease for this tenant
  const { data: lease } = await supabase
    .from("leases")
    .select("id, signed_at")
    .eq("tenant_id", tenantId)
    .neq("status", "terminated")
    .is("signed_at", null)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lease) {
    return Response.json(
      { error: "No unsigned lease for this tenant. Create a lease first." },
      { status: 404 }
    );
  }

  const result = await createOnboardingInvite(lease.id);
  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ url: result.url });
}
