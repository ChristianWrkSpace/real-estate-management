import { createServerSupabaseClient } from "./supabase-server";
import { hasPermission, type Permission, type Role } from "./permissions";

export interface AuthedUser {
  id: string;
  email: string | null;
  name: string;
  role: Role;
}

/**
 * Get the current authenticated user with their profile + role.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<AuthedUser | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get user profile with role from public.users table
  const { data: profile } = await supabase
    .from("users")
    .select("id, email, name, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Create profile if it doesn't exist
    const { error } = await supabase.from("users").insert({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
      role: "owner", // First user is owner
    });

    if (error) return null;

    return {
      id: user.id,
      email: user.email ?? null,
      name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
      role: "owner",
    };
  }

  return {
    id: profile.id,
    email: profile.email ?? null,
    name: profile.name ?? "User",
    role: profile.role as Role,
  };
}

/**
 * Require an authenticated user with a specific permission.
 * Returns the user if allowed, or an { error } object to bail with.
 */
export async function requirePermission(
  perm: Permission
): Promise<{ user: AuthedUser } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (!hasPermission(user.role, perm)) {
    return { error: `Permission denied: ${perm} requires ${getRolesWithPermission(perm).join(", ")}.` };
  }
  return { user };
}

function getRolesWithPermission(perm: Permission): string[] {
  const roles: Role[] = ["owner", "manager", "maintenance"];
  return roles.filter((r) => hasPermission(r, perm));
}
