import { createServerSupabaseClient } from "@/lib/supabase-server";
import WorkOrdersBoard, {
  type Unit,
  type Vendor,
  type WorkOrder,
} from "@/components/WorkOrdersBoard";

export const dynamic = "force-dynamic";

export default async function WorkOrdersPage() {
  const supabase = await createServerSupabaseClient();

  const { data: properties } = await supabase.from("properties").select("id").limit(1);
  const propertyId = properties?.[0]?.id;

  const [ordersRes, vendorsRes, unitsRes] = await Promise.all([
    supabase
      .from("work_orders")
      .select(
        "id, title, description, status, priority, unit_id, vendor_id, estimated_cost, actual_cost, created_at"
      )
      .eq("property_id", propertyId || "")
      .order("created_at", { ascending: false }),
    supabase
      .from("vendors")
      .select("id, name, trade")
      .order("name", { ascending: true }),
    supabase
      .from("units")
      .select("id, unit_number")
      .eq("property_id", propertyId || "")
      .order("unit_number", { ascending: true }),
  ]);

  const orders: WorkOrder[] = (ordersRes.data ?? []) as WorkOrder[];
  const vendors: Vendor[] = (vendorsRes.data ?? []) as Vendor[];
  const units: Unit[] = (unitsRes.data ?? []) as Unit[];

  return <WorkOrdersBoard initialOrders={orders} vendors={vendors} units={units} />;
}
