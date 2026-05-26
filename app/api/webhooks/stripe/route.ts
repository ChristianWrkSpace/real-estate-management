import { NextRequest } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

function getStripe(): { stripe: Stripe; webhookSecret: string } | null {
  const key = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !webhookSecret) return null;
  return { stripe: new Stripe(key), webhookSecret };
}

export async function POST(request: NextRequest) {
  const cfg = getStripe();
  if (!cfg) {
    return Response.json(
      { error: "Stripe env vars not configured (STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET)" },
      { status: 500 }
    );
  }
  const { stripe, webhookSecret } = cfg;

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    console.error("Stripe webhook signature verification failed:", msg);
    return Response.json({ error: `Webhook signature failed: ${msg}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Idempotency — skip if we've already processed this event
  const { data: existing } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existing) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase);
    } else if (event.type === "invoice.paid") {
      await handleInvoicePaid(event.data.object as Stripe.Invoice, supabase);
    }

    await supabase.from("stripe_events").insert({
      id: event.id,
      type: event.type,
      payload: event.data.object as unknown as Record<string, unknown>,
    });

    return Response.json({ received: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Handler failed";
    console.error("Stripe webhook handler error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, supabase: AdminClient) {
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  const amountTotal = session.amount_total ?? 0;
  if (!customerId || amountTotal <= 0) return;

  const propertyId = session.metadata?.property_id;
  const tenantIdMeta = session.metadata?.tenant_id;
  const unitIdMeta = session.metadata?.unit_id;

  await insertRentTransaction({
    supabase,
    customerId,
    amountCents: amountTotal,
    occurredAt: new Date((session.created ?? Date.now() / 1000) * 1000),
    description: session.metadata?.description || "Rent payment (Stripe)",
    externalId: session.id,
    propertyIdHint: propertyId,
    tenantIdHint: tenantIdMeta,
    unitIdHint: unitIdMeta,
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice, supabase: AdminClient) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const amountPaid = invoice.amount_paid ?? 0;
  if (!customerId || amountPaid <= 0) return;

  await insertRentTransaction({
    supabase,
    customerId,
    amountCents: amountPaid,
    occurredAt: new Date((invoice.created ?? Date.now() / 1000) * 1000),
    description: `Rent payment — invoice ${invoice.number ?? invoice.id}`,
    externalId: invoice.id ?? `inv_${Date.now()}`,
  });
}

async function insertRentTransaction(args: {
  supabase: AdminClient;
  customerId: string;
  amountCents: number;
  occurredAt: Date;
  description: string;
  externalId: string;
  propertyIdHint?: string;
  tenantIdHint?: string;
  unitIdHint?: string;
}) {
  const {
    supabase,
    customerId,
    amountCents,
    occurredAt,
    description,
    propertyIdHint,
    tenantIdHint,
    unitIdHint,
  } = args;

  // Resolve tenant from stripe_customer_id (or via metadata hint)
  let tenant: { id: string; property_id: string } | null = null;

  if (tenantIdHint) {
    const { data } = await supabase
      .from("tenants")
      .select("id, property_id")
      .eq("id", tenantIdHint)
      .maybeSingle();
    if (data) tenant = data;
  }

  if (!tenant) {
    const { data } = await supabase
      .from("tenants")
      .select("id, property_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (data) tenant = data;
  }

  if (!tenant) {
    console.warn(`Stripe payment from unknown customer ${customerId} — no tenant link`);
    return;
  }

  // Resolve unit from active lease
  let unitId: string | null = unitIdHint ?? null;
  if (!unitId) {
    const { data: lease } = await supabase
      .from("leases")
      .select("unit_id")
      .eq("tenant_id", tenant.id)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lease) unitId = lease.unit_id;
  }

  const propertyId = propertyIdHint || tenant.property_id;
  const amount = amountCents / 100;
  const date = occurredAt.toISOString().split("T")[0];

  const { error } = await supabase.from("transactions").insert({
    property_id: propertyId,
    unit_id: unitId,
    amount,
    date,
    type: "income",
    category: "rent",
    description,
    notes: `Stripe customer ${customerId}`,
  });

  if (error) throw error;
}
