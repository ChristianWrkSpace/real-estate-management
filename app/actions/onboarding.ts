"use server";

import { randomBytes } from "crypto";
import Stripe from "stripe";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";
import { buildLeasePdf } from "@/lib/lease-pdf";
import { sendEmail } from "@/lib/resend";

const BUCKET = "contracts";

export type OnboardingContext = {
  lease_id: string;
  status: string;
  signed_at: string | null;
  monthly_rent: number;
  security_deposit: number | null;
  start_date: string;
  end_date: string | null;
  lease_type: string;
  tenant: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  };
  unit: {
    id: string;
    unit_number: string;
    bedrooms: number | null;
    bathrooms: number | null;
    sqft: number | null;
  };
  property: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    owner_entity: string | null;
  };
};

/**
 * Resolves a lease + tenant + unit + property bundle for the public
 * /onboard/[lease_id] route. Reads via the SECURITY DEFINER RPC so
 * the anon role can only see the row whose onboarding_token matches.
 */
export async function getOnboardingContext(
  token: string
): Promise<OnboardingContext | null> {
  if (!token) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_lease_for_onboarding", {
    p_token: token,
  });
  if (error || !data || data.length === 0) return null;
  const r = data[0];
  return {
    lease_id: r.lease_id,
    status: r.status,
    signed_at: r.signed_at,
    monthly_rent: Number(r.monthly_rent),
    security_deposit: r.security_deposit != null ? Number(r.security_deposit) : null,
    start_date: r.start_date,
    end_date: r.end_date,
    lease_type: r.lease_type,
    tenant: {
      id: r.tenant_id,
      first_name: r.tenant_first_name,
      last_name: r.tenant_last_name,
      email: r.tenant_email,
      phone: r.tenant_phone,
    },
    unit: {
      id: r.unit_id,
      unit_number: r.unit_number,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      sqft: r.sqft,
    },
    property: {
      id: r.property_id,
      name: r.property_name,
      address: r.property_address,
      city: r.property_city,
      state: r.property_state,
      zip: r.property_zip,
      owner_entity: r.owner_entity,
    },
  };
}

export type AcceptInput = {
  token: string;
  signatureName: string;
  verifiedEmail: string;
  verifiedPhone?: string;
  acceptedTerms: boolean;
};

export type AcceptResult = {
  success: boolean;
  error?: string;
  lease_id?: string;
  payment_link_url?: string | null;
  document_url?: string | null;
};

/**
 * The end-to-end "tenant clicks ACCEPT" pipeline:
 *   1. Stamp lease.signed_at + lease.signature_name + lease.status='active'
 *   2. Update tenant's verified email/phone/status
 *   3. Generate and upload the signed lease PDF to the contracts bucket
 *   4. Create or reuse a Stripe Customer for the tenant
 *   5. Create a Checkout Session (payment link) for this month's rent
 *   6. Email the tenant their payment link via Resend
 *   7. Flip the unit from 'vacant' → 'occupied'
 *
 * Steps 3–7 are best-effort: lease acceptance always succeeds first.
 * Each post-acceptance step is logged but does not block the response.
 */
export async function acceptLeaseAndOnboard(input: AcceptInput): Promise<AcceptResult> {
  if (!input.token) return { success: false, error: "Missing onboarding token" };
  if (!input.signatureName?.trim()) return { success: false, error: "Signature name required" };
  if (!input.verifiedEmail?.trim()) return { success: false, error: "Email required" };
  if (!input.acceptedTerms) return { success: false, error: "You must accept the terms to continue" };

  const ctx = await getOnboardingContext(input.token);
  if (!ctx) return { success: false, error: "Invalid or expired onboarding link" };
  if (ctx.signed_at) {
    return {
      success: false,
      error: "This lease has already been signed — request a new link from the landlord.",
    };
  }

  const admin = createAdminClient();
  const signedAt = new Date().toISOString();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  // ── 1. Stamp the lease ──────────────────────────────────────────────────
  const { error: leaseErr } = await admin
    .from("leases")
    .update({
      status: "active",
      signed_at: signedAt,
      signature_name: input.signatureName.trim(),
      signature_ip: ip,
      onboarding_token: null, // burn the token — one-time use
    })
    .eq("id", ctx.lease_id);
  if (leaseErr) return { success: false, error: `Lease update failed: ${leaseErr.message}` };

  // ── 2. Tenant verified contact + active status ─────────────────────────
  await admin
    .from("tenants")
    .update({
      email: input.verifiedEmail.trim(),
      phone: input.verifiedPhone?.trim() || ctx.tenant.phone,
      status: "active",
    })
    .eq("id", ctx.tenant.id);

  // ── 3. Generate + upload lease PDF (best-effort) ───────────────────────
  let documentUrl: string | null = null;
  try {
    const pdfBytes = await buildLeasePdf({
      property_name: ctx.property.name,
      property_full_address: `${ctx.property.address}, ${ctx.property.city}, ${ctx.property.state} ${ctx.property.zip}`,
      owner_entity: ctx.property.owner_entity || "Landlord",
      tenant_name: `${ctx.tenant.first_name} ${ctx.tenant.last_name}`.trim(),
      tenant_email: input.verifiedEmail,
      tenant_phone: input.verifiedPhone || ctx.tenant.phone,
      unit_number: ctx.unit.unit_number,
      monthly_rent: ctx.monthly_rent,
      security_deposit: ctx.security_deposit,
      start_date: ctx.start_date,
      end_date: ctx.end_date,
      lease_type: ctx.lease_type,
      signature_name: input.signatureName.trim(),
      signed_at: signedAt,
      signature_ip: ip,
    });
    const key = `${ctx.property.id}/${ctx.lease_id}/signed-${Date.now()}.pdf`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(key, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (!upErr) {
      const { data: signed } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(key, 60 * 60 * 24 * 365); // 1 year
      documentUrl = signed?.signedUrl ?? key;
      await admin
        .from("leases")
        .update({ document_url: documentUrl, document_path: key })
        .eq("id", ctx.lease_id);
    } else {
      console.warn("Lease PDF upload failed:", upErr.message);
    }
  } catch (err) {
    console.warn("Lease PDF generation failed:", err);
  }

  // ── 4–5. Stripe customer + payment link (best-effort) ──────────────────
  let paymentLinkUrl: string | null = null;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey) {
    try {
      const stripe = new Stripe(stripeKey);

      // Reuse existing tenant Stripe customer if present
      const { data: existingTenant } = await admin
        .from("tenants")
        .select("stripe_customer_id")
        .eq("id", ctx.tenant.id)
        .maybeSingle();

      let customerId = existingTenant?.stripe_customer_id as string | null;
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: `${ctx.tenant.first_name} ${ctx.tenant.last_name}`.trim(),
          email: input.verifiedEmail,
          phone: input.verifiedPhone,
          metadata: {
            tenant_id: ctx.tenant.id,
            property_id: ctx.property.id,
            unit_id: ctx.unit.id,
            lease_id: ctx.lease_id,
          },
        });
        customerId = customer.id;
        await admin
          .from("tenants")
          .update({ stripe_customer_id: customerId })
          .eq("id", ctx.tenant.id);
      }

      const origin =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      const monthLabel = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        success_url: `${origin}/onboard/${input.token}?paid=1`,
        cancel_url: `${origin}/onboard/${input.token}`,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Rent — Unit ${ctx.unit.unit_number}`,
                description: `${monthLabel} rent for ${ctx.tenant.first_name} ${ctx.tenant.last_name}`,
              },
              unit_amount: Math.round(ctx.monthly_rent * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          tenant_id: ctx.tenant.id,
          property_id: ctx.property.id,
          unit_id: ctx.unit.id,
          lease_id: ctx.lease_id,
          description: `Rent — ${ctx.tenant.first_name} ${ctx.tenant.last_name} — ${monthLabel}`,
        },
      });

      paymentLinkUrl = session.url;
      if (paymentLinkUrl) {
        await admin
          .from("leases")
          .update({ payment_link_url: paymentLinkUrl })
          .eq("id", ctx.lease_id);
      }
    } catch (err) {
      console.warn("Stripe provisioning failed:", err);
    }
  } else {
    console.warn("STRIPE_SECRET_KEY not set — skipping payment link creation");
  }

  // ── 6. Resend onboarding email (best-effort) ───────────────────────────
  if (process.env.RESEND_API_KEY && input.verifiedEmail) {
    try {
      await sendEmail({
        to: input.verifiedEmail,
        subject: `Welcome to ${ctx.property.name} — your rent portal is ready`,
        html: welcomeEmail({
          tenantFirst: ctx.tenant.first_name,
          propertyName: ctx.property.name,
          unitNumber: ctx.unit.unit_number,
          monthlyRent: ctx.monthly_rent,
          paymentLink: paymentLinkUrl,
          leaseUrl: documentUrl,
        }),
      });
    } catch (err) {
      console.warn("Resend onboarding email failed:", err);
    }
  }

  // ── 7. Flip the unit occupancy ─────────────────────────────────────────
  await admin
    .from("units")
    .update({ status: "occupied" })
    .eq("id", ctx.unit.id);

  revalidatePath("/units");
  revalidatePath("/tenants");
  revalidatePath("/dashboard");

  return {
    success: true,
    lease_id: ctx.lease_id,
    payment_link_url: paymentLinkUrl,
    document_url: documentUrl,
  };
}

/**
 * Owner-side: mint a fresh onboarding token for an existing lease and
 * return the public URL. Idempotent — overwrites any prior token.
 */
export async function createOnboardingInvite(leaseId: string): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: lease, error } = await supabase
    .from("leases")
    .select("id, signed_at")
    .eq("id", leaseId)
    .maybeSingle();
  if (error || !lease) return { success: false, error: "Lease not found" };
  if (lease.signed_at) {
    return { success: false, error: "Lease is already signed" };
  }

  const token = randomBytes(24).toString("base64url");
  const { error: updErr } = await admin
    .from("leases")
    .update({
      onboarding_token: token,
      onboarding_sent_at: new Date().toISOString(),
    })
    .eq("id", leaseId);
  if (updErr) return { success: false, error: updErr.message };

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return { success: true, url: `${origin}/onboard/${token}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// templates
// ─────────────────────────────────────────────────────────────────────────────

function welcomeEmail(args: {
  tenantFirst: string;
  propertyName: string;
  unitNumber: string;
  monthlyRent: number;
  paymentLink: string | null;
  leaseUrl: string | null;
}): string {
  const fmtUsd = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  const payBlock = args.paymentLink
    ? `<p><a href="${args.paymentLink}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Pay first month's rent (${fmtUsd(args.monthlyRent)})</a></p>
       <p style="font-size:13px;color:#475569;">Bookmark this link — it's your permanent rent portal.</p>`
    : `<p style="color:#475569;">Your landlord will follow up with payment details shortly.</p>`;
  const leaseBlock = args.leaseUrl
    ? `<p><a href="${args.leaseUrl}" style="color:#2563eb;">View your signed lease (PDF)</a></p>`
    : "";
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0f172a;">
    <h1 style="font-size:22px;margin:0 0 8px;">Welcome, ${args.tenantFirst}.</h1>
    <p style="color:#475569;">You've successfully signed your lease for <strong>${args.propertyName}, Unit ${args.unitNumber}</strong>. Monthly rent is <strong>${fmtUsd(args.monthlyRent)}</strong>.</p>
    ${payBlock}
    ${leaseBlock}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:12px;color:#94a3b8;">Sent by PropMan OS. Reply to this email if anything looks wrong.</p>
  </body></html>`;
}
