import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

export const X402_PRICES = {
  plan_generation: 50,
  session_start: 100,
  session_analyze: 10,
} as const;

export type X402Endpoint = keyof typeof X402_PRICES;

export interface X402Payment {
  amount: number;
  currency: string;
  description: string;
  endpoint: X402Endpoint;
}

export function getX402Price(endpoint: X402Endpoint): number {
  return X402_PRICES[endpoint];
}

export function getX402Description(endpoint: X402Endpoint): string {
  const descriptions: Record<X402Endpoint, string> = {
    plan_generation: "Learning plan generation",
    session_start: "Tutoring session start",
    session_analyze: "Audio chunk analysis",
  };
  return descriptions[endpoint];
}

export function createX402Response(
  endpoint: X402Endpoint,
  additionalInfo?: Record<string, string>
): Response {
  const price = getX402Price(endpoint);
  const description = getX402Description(endpoint);

  const headers: Record<string, string> = {
    "X-402-Amount": price.toString(),
    "X-402-Currency": "usd",
    "X-402-Description": description,
  };

  if (additionalInfo) {
    for (const [key, value] of Object.entries(additionalInfo)) {
      headers[`X-402-${key}`] = value;
    }
  }

  return new Response(
    JSON.stringify({
      error: "Payment required",
      message: `This endpoint requires payment. Amount: $${(price / 100).toFixed(2)}`,
      x402: {
        amount: price,
        currency: "usd",
        description,
        endpoint,
      },
    }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    }
  );
}

export async function createPaymentIntent(
  amount: number,
  userId: string,
  endpoint: X402Endpoint,
  metadata?: Record<string, string>
): Promise<Stripe.PaymentIntent> {
  const description = getX402Description(endpoint);

  return await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    description,
    metadata: {
      user_id: userId,
      endpoint,
      ...metadata,
    },
  });
}

export async function verifyPayment(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent | null> {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === "succeeded") {
      return paymentIntent;
    }
    return null;
  } catch {
    return null;
  }
}

export function createPaymentLink(
  endpoint: X402Endpoint,
  userId: string,
  successUrl: string,
  cancelUrl: string
): string {
  const price = getX402Price(endpoint);
  const description = getX402Description(endpoint);

  const params = new URLSearchParams({
    "price_data[unit_amount]": price.toString(),
    "price_data[currency]": "usd",
    "price_data[product_data][name]": `Uncertain Systems - ${description}`,
    "price_data[product_data][description]": `Payment for ${endpoint}`,
    "quantity": "1",
    "success_url": successUrl,
    "cancel_url": cancelUrl,
    "metadata[user_id]": userId,
    "metadata[endpoint]": endpoint,
  });

  const baseUrl = process.env.STRIPE_PORTAL_URL || "https://checkout.stripe.com";
  return `${baseUrl}/pay?${params.toString()}`;
}

export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyApiKey(
  providedKey: string,
  keyHash: string
): Promise<boolean> {
  const providedHash = await hashApiKey(providedKey);
  return providedHash === keyHash;
}

export function getApiKeyPrefix(key: string): string {
  return key.substring(0, 8);
}
