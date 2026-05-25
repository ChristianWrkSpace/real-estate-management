export type Role = "owner" | "manager" | "maintenance";

export type Permission =
  | "view_all"
  | "manage_units"
  | "manage_tenants"
  | "manage_leases"
  | "collect_rent"
  | "manage_work_orders"
  | "view_work_orders"
  | "manage_contractors"
  | "approve_payments"
  | "view_finances"
  | "manage_equity"
  | "manage_contracts"
  | "view_audit";

const PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    "view_all",
    "manage_units",
    "manage_tenants",
    "manage_leases",
    "collect_rent",
    "manage_work_orders",
    "view_work_orders",
    "manage_contractors",
    "approve_payments",
    "view_finances",
    "manage_equity",
    "manage_contracts",
    "view_audit",
  ],
  manager: [
    "view_all",
    "manage_units",
    "manage_tenants",
    "manage_leases",
    "collect_rent",
    "manage_work_orders",
    "view_work_orders",
    "manage_contractors",
    "view_finances",
    "manage_contracts",
  ],
  maintenance: ["manage_work_orders", "view_work_orders"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}
