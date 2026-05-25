import { Role } from "./permissions";

export const NAV_SECTIONS = {
  main: [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/units", label: "Units", icon: "🏠" },
    { href: "/tenants", label: "Tenants", icon: "👥" },
  ],
  operations: [
    { href: "/rent", label: "Rent", icon: "💰" },
    { href: "/work-orders", label: "Work Orders", icon: "🔧" },
    { href: "/contractors", label: "Contractors", icon: "👷" },
  ],
  management: [
    { href: "/contracts", label: "Contracts", icon: "📄" },
    { href: "/finances", label: "P&L", icon: "📈" },
    { href: "/equity", label: "Equity", icon: "🏦" },
  ],
  admin: [{ href: "/approvals", label: "Approvals", icon: "✅" }],
};

export function getNavSectionsForRole(role: Role) {
  if (role === "owner") {
    return Object.values(NAV_SECTIONS).flat();
  }
  if (role === "manager") {
    return Object.values(NAV_SECTIONS).flat();
  }
  if (role === "maintenance") {
    return [NAV_SECTIONS.operations[1]]; // Only work orders
  }
  return [];
}
