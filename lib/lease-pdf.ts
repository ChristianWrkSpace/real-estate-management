/**
 * Minimal lease-PDF generator using pdf-lib.
 * Single-page, plain text, no fonts beyond the built-in Helvetica family.
 * Produces a small (<10KB) signed lease document suitable for the
 * Supabase `contracts` bucket.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type LeasePdfInput = {
  property_name: string;
  property_full_address: string;
  owner_entity: string;
  tenant_name: string;
  tenant_email: string | null;
  tenant_phone: string | null;
  unit_number: string;
  monthly_rent: number;
  security_deposit: number | null;
  start_date: string;
  end_date: string | null;
  lease_type: string;
  signature_name: string;
  signed_at: string;
  signature_ip: string;
};

export async function buildLeasePdf(input: LeasePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Lease — ${input.property_name} Unit ${input.unit_number}`);
  doc.setAuthor(input.owner_entity);
  doc.setSubject(`Residential lease for ${input.tenant_name}`);
  doc.setProducer("PropMan OS");
  doc.setCreationDate(new Date());

  const page = doc.addPage([612, 792]); // US Letter
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width } = page.getSize();
  const margin = 56;
  let y = 740;

  const write = (text: string, size = 11, useBold = false) => {
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0.07, 0.07, 0.07),
      maxWidth: width - margin * 2,
    });
    y -= size + 6;
  };

  const rule = () => {
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: width - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 10;
  };

  write("RESIDENTIAL LEASE AGREEMENT", 16, true);
  y -= 4;
  write(input.property_full_address, 10);
  rule();

  write(`Landlord: ${input.owner_entity}`, 11, true);
  write(`Tenant:   ${input.tenant_name}`, 11, true);
  if (input.tenant_email) write(`Email:    ${input.tenant_email}`);
  if (input.tenant_phone) write(`Phone:    ${input.tenant_phone}`);
  y -= 4;

  write("1. PREMISES", 12, true);
  write(
    `Landlord rents to Tenant Unit ${input.unit_number} at ${input.property_full_address} ("the Premises").`
  );
  y -= 4;

  write("2. TERM", 12, true);
  const termText = input.end_date
    ? `Fixed term from ${input.start_date} through ${input.end_date}.`
    : `Month-to-month tenancy beginning ${input.start_date}.`;
  write(`${termText} (${input.lease_type})`);
  y -= 4;

  write("3. RENT", 12, true);
  write(
    `Tenant agrees to pay monthly rent of $${input.monthly_rent.toFixed(2)}, due on the first of each month.`
  );
  if (input.security_deposit && input.security_deposit > 0) {
    write(
      `A security deposit of $${input.security_deposit.toFixed(2)} is held by Landlord and refundable per Texas Property Code §92.103.`
    );
  }
  y -= 4;

  write("4. USE & OCCUPANCY", 12, true);
  write(
    "The Premises shall be used solely as a private residence. Tenant shall maintain the Premises in clean and sanitary condition."
  );
  y -= 4;

  write("5. MAINTENANCE & REPAIRS", 12, true);
  write(
    "Landlord shall maintain habitability per Texas Property Code §92.052. Tenant shall promptly report any defects via the PropMan OS work-order portal."
  );
  y -= 4;

  write("6. PAYMENT METHOD", 12, true);
  write(
    "Rent is collected via the secure Stripe payment portal linked in Tenant's onboarding email. Late fees apply per Texas statute."
  );
  y -= 4;

  write("7. ELECTRONIC SIGNATURE", 12, true);
  write(
    "Tenant acknowledges that clicking ACCEPT on the onboarding portal constitutes a legally binding electronic signature under the federal E-SIGN Act and Texas UETA."
  );
  y -= 8;

  rule();
  write("DIGITAL SIGNATURE", 12, true);
  write(`Signed by: ${input.signature_name}`);
  write(`Signed at: ${input.signed_at}`);
  write(`Source IP: ${input.signature_ip}`);
  y -= 4;
  write("This document was generated and stored by PropMan OS.", 9);

  return doc.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// Texas Property Code § 24.005 — 3-Day Notice to Vacate
// ─────────────────────────────────────────────────────────────────────────────

export type NoticeToVacateInput = {
  property_full_address: string;
  owner_entity: string;
  owner_signer_name: string;     // who signs the notice
  tenant_name: string;
  unit_number: string;
  past_due_balance: number;       // total unpaid as of issue date
  rent_due_date: string;          // YYYY-MM-DD — when the unpaid rent was due
  notice_period_days: number;     // 3 unless lease overrides (statute minimum)
  delivery_method:                // how the notice will be served
    | "in_person"
    | "first_class_mail"
    | "certified_mail"
    | "posted_on_door";
  issued_at: string;              // ISO timestamp of generation
  vacate_by: string;              // ISO date the tenant must surrender by
};

/**
 * Texas Property Code § 24.005 compliant Notice to Vacate (eviction
 * predicate). Single-page, plain text, no third-party fonts.
 *
 * The notice itself does NOT evict the tenant — it's the statutory
 * prerequisite the landlord must serve before filing a forcible
 * detainer (eviction) suit in Justice Court. See § 24.005(a) for
 * the minimum 3-day window (subject to lease override).
 */
export async function generateTexasNoticeToVacate(
  input: NoticeToVacateInput
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Notice to Vacate — ${input.tenant_name} — Unit ${input.unit_number}`);
  doc.setAuthor(input.owner_entity);
  doc.setSubject("Texas Property Code § 24.005 — Notice to Vacate");
  doc.setProducer("PropMan OS");
  doc.setCreationDate(new Date());

  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width } = page.getSize();
  const margin = 56;
  let y = 740;

  const write = (text: string, size = 11, useBold = false) => {
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0.07, 0.07, 0.07),
      maxWidth: width - margin * 2,
    });
    y -= size + 6;
  };
  const wrap = (text: string, size = 11) => {
    const maxChars = 92;
    const words = text.split(/\s+/);
    let line = "";
    for (const w of words) {
      if ((line + " " + w).trim().length > maxChars) {
        write(line.trim(), size);
        line = w;
      } else {
        line = (line ? line + " " : "") + w;
      }
    }
    if (line.trim()) write(line.trim(), size);
  };
  const rule = () => {
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: width - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.65, 0.65, 0.65),
    });
    y -= 10;
  };

  const fmtUsd = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };
  const deliveryLabel: Record<NoticeToVacateInput["delivery_method"], string> = {
    in_person: "Delivered in person to the tenant",
    first_class_mail: "Sent by first-class mail to the premises",
    certified_mail: "Sent by certified mail, return receipt requested",
    posted_on_door: "Securely affixed to the inside of the main entry door",
  };

  // ── Header ───────────────────────────────────────────────────────────────
  write("NOTICE TO VACATE", 18, true);
  y -= 2;
  write("Texas Property Code § 24.005", 10);
  rule();

  // ── Parties ──────────────────────────────────────────────────────────────
  write(`Date issued: ${fmtDate(input.issued_at)}`, 11);
  y -= 2;
  write(`TO:   ${input.tenant_name}`, 12, true);
  write(`      ${input.property_full_address}`, 11);
  write(`      Unit ${input.unit_number}`, 11);
  y -= 4;
  write(`FROM: ${input.owner_entity}`, 12, true);
  y -= 4;
  rule();

  // ── Body ─────────────────────────────────────────────────────────────────
  write("RE: DEMAND FOR POSSESSION", 12, true);
  y -= 2;

  wrap(
    `You are hereby notified that you are in default under your lease agreement for the premises identified above due to non-payment of rent.`
  );
  y -= 2;
  wrap(
    `The total amount of unpaid rent currently due and owing is ${fmtUsd(
      input.past_due_balance
    )}, which became due on ${fmtDate(input.rent_due_date)} and remains unpaid as of the date of this notice.`
  );
  y -= 2;
  wrap(
    `Pursuant to Texas Property Code § 24.005, the landlord hereby DEMANDS that you surrender possession of the premises and vacate within ${input.notice_period_days} days from the date of delivery of this notice — on or before ${fmtDate(
      input.vacate_by
    )}.`
  );
  y -= 2;
  wrap(
    `Failure to vacate by that date will result in the landlord filing a forcible detainer (eviction) suit in the appropriate Justice Court of Webb County, Texas. You may also be held liable for past-due rent, late fees, court costs, and reasonable attorney's fees.`
  );
  y -= 2;
  wrap(
    `If full payment of the amount stated above is received by the landlord prior to expiration of the notice period and the lease has not been terminated, the landlord may, at the landlord's sole discretion, withdraw this notice.`
  );
  y -= 2;
  wrap(
    `This notice is the statutory prerequisite to eviction under § 24.005 and does not constitute an eviction itself. Any amounts paid after this notice are accepted only on account of the past-due balance and do not waive the landlord's right to proceed.`
  );

  y -= 6;
  rule();

  // ── Delivery + signature ────────────────────────────────────────────────
  write("METHOD OF DELIVERY", 11, true);
  write(deliveryLabel[input.delivery_method], 11);
  y -= 4;

  write("LANDLORD / AGENT SIGNATURE", 11, true);
  y -= 14;
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + 260, y },
    thickness: 0.5,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 12;
  write(input.owner_signer_name, 10);
  write(`Authorized agent for ${input.owner_entity}`, 9);
  write(`Issued at: ${new Date(input.issued_at).toISOString()}`, 9);

  y -= 8;
  rule();
  write("This document was generated and recorded by PropMan OS.", 9);

  return doc.save();
}

