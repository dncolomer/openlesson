import Stripe from "stripe";

let cachedClient: Stripe | null = null;
let cachedKey: string | null = null;

/**
 * Lazily construct the server-side Stripe SDK client.
 * Avoids module-load side effects and centralizes SDK configuration in one place.
 */
export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!cachedClient || cachedKey !== secretKey) {
    cachedClient = new Stripe(secretKey);
    cachedKey = secretKey;
  }
  return cachedClient;
}
