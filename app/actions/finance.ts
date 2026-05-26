"use server";

import Stripe from "stripe";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";

export async function addTransaction(data: {
  propertyId: string;
  unitId?: string | null;
  amount: number;
  date: string;
  type: "income" | "expense";
  category: string;
  description?: string;
  receiptUrl?: string;
  notes?: string;
}) {
  const supabase = await createServerSupabaseClient();

  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      property_id: data.propertyId,
      unit_id: data.unitId || null,
      amount: data.amount,
      date: data.date,
      type: data.type,
      category: data.category,
      description: data.description,
      receipt_url: data.receiptUrl,
      notes: data.notes,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, transaction };
}

export async function getMonthSummary(propertyId: string, year: number, month: number) {
  const supabase = await createServerSupabaseClient();

  const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("property_id", propertyId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) {
    return { success: false, error: error.message };
  }

  const income = transactions
    .filter((t: any) => t.type === "income")
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

  const expenses = transactions
    .filter((t: any) => t.type === "expense")
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

  return {
    success: true,
    income,
    expenses,
    noi: income - expenses,
    transactions,
  };
}

export async function getMonthTransactions(propertyId: string, year: number, month: number) {
  const supabase = await createServerSupabaseClient();

  const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("property_id", propertyId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, transactions };
}

export async function getYearToDateSummary(propertyId: string) {
  const supabase = await createServerSupabaseClient();

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("property_id", propertyId)
    .gte("date", startOfYear)
    .lte("date", today);

  if (error) {
    return { success: false, error: error.message };
  }

  const income = transactions
    .filter((t: any) => t.type === "income")
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

  const expenses = transactions
    .filter((t: any) => t.type === "expense")
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

  return { success: true, income, expenses, noi: income - expenses };
}

export async function createRentPaymentLink(
  tenantId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { success: false, error: "STRIPE_SECRET_KEY not configured" };
  }

  const supabase = createAdminClient();

  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, first_name, last_name, email, property_id, stripe_customer_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantErr || !tenant) {
    return { success: false, error: "Tenant not found" };
  }

  const { data: lease } = await supabase
    .from("leases")
    .select("id, unit_id, monthly_rent")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lease || !lease.monthly_rent || Number(lease.monthly_rent) <= 0) {
    return {
      success: false,
      error: "No active lease with monthly rent for this tenant",
    };
  }

  const stripe = new Stripe(secret);

  let stripeCustomerId = tenant.stripe_customer_id as string | null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: `${tenant.first_name} ${tenant.last_name}`.trim(),
      email: tenant.email || undefined,
      metadata: { tenant_id: tenant.id, property_id: tenant.property_id },
    });
    stripeCustomerId = customer.id;
    await supabase
      .from("tenants")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", tenant.id);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";
  const origin = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  const monthLabel = new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
    success_url: `${origin}/rent?paid=1`,
    cancel_url: `${origin}/rent?canceled=1`,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Rent — ${tenant.first_name} ${tenant.last_name}`,
            description: `Monthly rent for ${monthLabel}`,
          },
          unit_amount: Math.round(Number(lease.monthly_rent) * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      tenant_id: tenant.id,
      property_id: tenant.property_id,
      unit_id: lease.unit_id,
      lease_id: lease.id,
      description: `Rent — ${tenant.first_name} ${tenant.last_name} — ${monthLabel}`,
    },
  });

  if (!session.url) {
    return { success: false, error: "Stripe did not return a checkout URL" };
  }

  return { success: true, url: session.url };
}
