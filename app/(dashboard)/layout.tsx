import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";

const NAV_SECTIONS = [
  {
    title: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "📊" },
      { href: "/units", label: "Units", icon: "🏠" },
      { href: "/tenants", label: "Tenants", icon: "👥" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/rent", label: "Rent", icon: "💰" },
      { href: "/work-orders", label: "Work Orders", icon: "🔧" },
      { href: "/contractors", label: "Contractors", icon: "👷" },
    ],
  },
  {
    title: "Management",
    items: [
      { href: "/contracts", label: "Contracts", icon: "📄" },
      { href: "/finances", label: "P&L", icon: "📈" },
      { href: "/equity", label: "Equity", icon: "🏦" },
    ],
  },
  {
    title: "Admin",
    items: [{ href: "/approvals", label: "Approvals", icon: "✅" }],
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-white/[0.06] bg-white/[0.015] p-6 backdrop-blur-xl">
        <Link href="/dashboard" className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 shadow-lg shadow-emerald-500/20">
            <span className="text-base">🏠</span>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-zinc-100">PropMan OS</div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Rosario St · Laredo
            </div>
          </div>
        </Link>

        <nav className="flex-1 space-y-6 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                {section.title}
              </h3>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-white/[0.04] hover:text-zinc-100"
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* User block */}
        <div className="mt-6 space-y-2.5 border-t border-white/[0.06] pt-4">
          <div>
            <p className="text-sm font-semibold tracking-tight text-zinc-100">{user.name}</p>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">{user.role}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-zinc-100"
            >
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
