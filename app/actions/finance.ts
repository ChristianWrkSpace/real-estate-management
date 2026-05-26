"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";

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
