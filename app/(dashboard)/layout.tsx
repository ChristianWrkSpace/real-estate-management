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
    <div className="flex h-screen bg-slate-950 text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-white/[0.02] p-6 flex flex-col">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2">
          <span className="text-2xl">🏢</span>
          <div>
            <div className="font-bold text-lg">PropMan OS</div>
            <div className="text-xs text-white/40">Rosario St, Laredo</div>
          </div>
        </Link>

        <nav className="flex-1 space-y-8 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 text-xs font-semibold text-white/50 uppercase tracking-wider">
                {section.title}
              </h3>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-white/5"
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* User section */}
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div className="text-sm">
            <p className="font-medium">{user.name}</p>
            <p className="text-xs text-white/50">{user.role}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
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
