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
