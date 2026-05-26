import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) cached = new Stripe(key);
  return cached;
}

export async function createPaymentLink(
  _email: string,
  amount: number,
  description: string
): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) {
    console.warn("STRIPE_SECRET_KEY not set — cannot create payment link");
    return null;
  }
  try {
    const link = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: description },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      after_completion: {
        type: "redirect",
        redirect: {
          url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/payment-success`,
        },
      },
      custom_fields: [
        {
          key: "tenant_email",
          label: { type: "custom", custom: "Email Address" },
          type: "text",
          optional: false,
        },
      ],
    });
    return link.url;
  } catch (error) {
    console.error("Failed to create payment link:", error);
    return null;
  }
}
