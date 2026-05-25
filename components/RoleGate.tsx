import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, type AuthedUser } from "@/lib/auth-helpers";
import type { Role } from "@/lib/permissions";

/**
 * Server-side role guard. Use at the top of any page/server component
 * that should only be visible to certain roles.
 *
 * Usage:
 *   const me = await requireRoles(["owner", "manager", "office"], "/my-day");
 *
 * `redirectTo` is where unauthorized users land. Default: /my-day for techs.
 * If user is logged out entirely, sends them to /login.
 */
export async function requireRoles(
  allowed: readonly Role[],
  redirectTo: string = "/my-day"
): Promise<AuthedUser> {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!allowed.includes(me.role)) redirect(redirectTo);
  return me;
}

/**
 * Soft variant — render an "Access restricted" panel inline rather than
 * redirecting. Useful when the page might link from somewhere a tech can
 * legitimately reach but shouldn't see the full content.
 */
export function NoAccessPanel({
  role,
  needs,
}: {
  role: string;
  needs: readonly string[];
}) {
  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
        <h1 className="text-xl font-bold text-white">Access restricted</h1>
        <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
          This page is for{" "}
          <span className="text-zinc-200">{needs.join(" / ")}</span> only. You're
          signed in as <span className="text-zinc-200 capitalize">{role}</span>.
          If you need access, ask the office to update your role.
        </p>
        <Link
          href="/my-day"
          className="inline-block mt-5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg"
        >
          Back to My Day
        </Link>
      </div>
    </div>
  );
}
