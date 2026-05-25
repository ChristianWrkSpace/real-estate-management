/**
 * Local in-memory database (no external DB needed)
 * Pre-populated with demo data for 1304 Rosario St
 */

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  units_count: number;
  current_value: number;
  mortgage_balance: number;
}

export interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  bedrooms: number;
  bathrooms: number;
  status: "occupied" | "vacant" | "maintenance";
  monthly_rent: number;
}

export interface Tenant {
  id: string;
  property_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: "active" | "former" | "prospect";
}

export interface Lease {
  id: string;
  unit_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  status: "active" | "expired" | "terminated";
}

export interface WorkOrder {
  id: string;
  unit_id: string;
  title: string;
  description: string;
  priority: "urgent" | "high" | "normal" | "low";
  status: "open" | "assigned" | "in_progress" | "completed" | "cancelled";
  created_at: string;
}

export interface Contractor {
  id: string;
  contact_name: string;
  phone: string;
  email: string;
  specialty: string;
}

// Database storage
const db = {
  properties: [] as Property[],
  units: [] as Unit[],
  tenants: [] as Tenant[],
  leases: [] as Lease[],
  workOrders: [] as WorkOrder[],
  contractors: [] as Contractor[],
};

// Initialize with demo data for 1304 Rosario St
export function initDemoData() {
  // Property
  const property: Property = {
    id: "prop-1304-rosario",
    name: "1304 Rosario St",
    address: "1304 Rosario St",
    city: "Laredo",
    state: "TX",
    zip: "78040",
    units_count: 4,
    current_value: 480000,
    mortgage_balance: 320000,
  };
  db.properties.push(property);

  // Units
  const units: Unit[] = [
    {
      id: "unit-1",
      property_id: "prop-1304-rosario",
      unit_number: "1",
      bedrooms: 2,
      bathrooms: 1,
      status: "occupied",
      monthly_rent: 1200,
    },
    {
      id: "unit-2",
      property_id: "prop-1304-rosario",
      unit_number: "2",
      bedrooms: 2,
      bathrooms: 1,
      status: "occupied",
      monthly_rent: 1200,
    },
    {
      id: "unit-3",
      property_id: "prop-1304-rosario",
      unit_number: "3",
      bedrooms: 2,
      bathrooms: 1,
      status: "vacant",
      monthly_rent: 1200,
    },
    {
      id: "unit-4",
      property_id: "prop-1304-rosario",
      unit_number: "4",
      bedrooms: 2,
      bathrooms: 1.5,
      status: "occupied",
      monthly_rent: 1300,
    },
  ];
  db.units.push(...units);

  // Tenants
  const tenants: Tenant[] = [
    {
      id: "tenant-1",
      property_id: "prop-1304-rosario",
      first_name: "John",
      last_name: "Rodriguez",
      email: "john.rodriguez@email.com",
      phone: "956-555-0101",
      status: "active",
    },
    {
      id: "tenant-2",
      property_id: "prop-1304-rosario",
      first_name: "Maria",
      last_name: "Garcia",
      email: "maria.garcia@email.com",
      phone: "956-555-0102",
      status: "active",
    },
    {
      id: "tenant-3",
      property_id: "prop-1304-rosario",
      first_name: "Carlos",
      last_name: "Lopez",
      email: "carlos.lopez@email.com",
      phone: "956-555-0103",
      status: "active",
    },
  ];
  db.tenants.push(...tenants);

  // Leases
  const leases: Lease[] = [
    {
      id: "lease-1",
      unit_id: "unit-1",
      tenant_id: "tenant-1",
      start_date: "2023-01-15",
      end_date: "2025-01-14",
      monthly_rent: 1200,
      status: "active",
    },
    {
      id: "lease-2",
      unit_id: "unit-2",
      tenant_id: "tenant-2",
      start_date: "2023-03-01",
      end_date: "2025-02-28",
      monthly_rent: 1200,
      status: "active",
    },
    {
      id: "lease-3",
      unit_id: "unit-4",
      tenant_id: "tenant-3",
      start_date: "2024-06-01",
      end_date: "2026-05-31",
      monthly_rent: 1300,
      status: "active",
    },
  ];
  db.leases.push(...leases);

  // Work Orders
  const workOrders: WorkOrder[] = [
    {
      id: "wo-1",
      unit_id: "unit-3",
      title: "HVAC Repair",
      description: "AC unit not cooling properly",
      priority: "high",
      status: "open",
      created_at: new Date().toISOString(),
    },
    {
      id: "wo-2",
      unit_id: "unit-1",
      title: "Sink Leak",
      description: "Kitchen sink has slow drain",
      priority: "normal",
      status: "assigned",
      created_at: new Date().toISOString(),
    },
  ];
  db.workOrders.push(...workOrders);

  // Contractors
  const contractors: Contractor[] = [
    {
      id: "cont-1",
      contact_name: "Miguel's HVAC",
      phone: "956-555-1001",
      email: "miguel@hvac.local",
      specialty: "hvac",
    },
    {
      id: "cont-2",
      contact_name: "Joe's Plumbing",
      phone: "956-555-1002",
      email: "joe@plumbing.local",
      specialty: "plumbing",
    },
  ];
  db.contractors.push(...contractors);
}

initDemoData();

// API functions
export const localDB = {
  // Properties
  getProperty: (id: string): Property | undefined => {
    return db.properties.find((p) => p.id === id);
  },
  getAllProperties: (): Property[] => {
    return db.properties;
  },

  // Units
  getUnits: (propertyId: string): Unit[] => {
    return db.units.filter((u) => u.property_id === propertyId);
  },
  getUnit: (id: string): Unit | undefined => {
    return db.units.find((u) => u.id === id);
  },
  addUnit: (unit: Unit): void => {
    db.units.push(unit);
  },

  // Tenants
  getTenants: (propertyId: string): Tenant[] => {
    return db.tenants.filter((t) => t.property_id === propertyId);
  },
  getTenant: (id: string): Tenant | undefined => {
    return db.tenants.find((t) => t.id === id);
  },
  addTenant: (tenant: Tenant): void => {
    db.tenants.push(tenant);
  },

  // Leases
  getLeases: (): Lease[] => {
    return db.leases;
  },
  getLeasesByUnit: (unitId: string): Lease[] => {
    return db.leases.filter((l) => l.unit_id === unitId);
  },
  addLease: (lease: Lease): void => {
    db.leases.push(lease);
  },

  // Work Orders
  getWorkOrders: (): WorkOrder[] => {
    return db.workOrders;
  },
  getOpenWorkOrders: (): WorkOrder[] => {
    return db.workOrders.filter((w) => w.status !== "completed" && w.status !== "cancelled");
  },
  addWorkOrder: (wo: WorkOrder): void => {
    db.workOrders.push(wo);
  },

  // Contractors
  getContractors: (): Contractor[] => {
    return db.contractors;
  },
  addContractor: (c: Contractor): void => {
    db.contractors.push(c);
  },
};
