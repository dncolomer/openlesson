#!/usr/bin/env node
/**
 * Register Stripe payment method domains, webhook endpoints, and business profile URL.
 * Idempotent: skips resources that already exist. Keeps existing domains/webhooks untouched.
 *
 * Usage:
 *   node scripts/add-stripe-domains.mjs              # test (STRIPE_SECRET_KEY from .env.local)
 *   node scripts/add-stripe-domains.mjs --production # live (PROD_STRIPE_SECRET_KEY from .env.local)
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/add-stripe-domains.mjs
 */
import Stripe from "stripe";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const useProduction = process.argv.includes("--production");

const DOMAINS = [
  "uncertain.systems",
  "www.uncertain.systems",
  "openlesson.academy",
  "www.openlesson.academy",
  "openlesson-uncertainsystems.vercel.app",
];

// Single canonical URL (matches legacy www.openlesson.academy webhook pattern).
const WEBHOOK_URLS = ["https://www.uncertain.systems/api/stripe/webhook"];

const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.deleted",
  "customer.subscription.updated",
  "invoice.created",
  "invoice.payment_succeeded",
];

const BUSINESS_PROFILE_URL = "https://uncertain.systems";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const secretKey = useProduction
  ? process.env.PROD_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY
  : process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  const hint = useProduction
    ? "PROD_STRIPE_SECRET_KEY is not set (.env.local or env)."
    : "STRIPE_SECRET_KEY is not set (.env.local or env).";
  console.error(hint);
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: "2026-01-28.clover" });
const mode = secretKey.startsWith("sk_live_") ? "live" : "test";
console.log(`Stripe target: ${useProduction ? "production" : "default"} (${mode} mode)`);

if (useProduction && mode !== "live") {
  console.error("Production run requires sk_live_... (set PROD_STRIPE_SECRET_KEY in .env.local).");
  process.exit(1);
}

const existing = await stripe.paymentMethodDomains.list({ limit: 100 });
const existingNames = new Set(existing.data.map((entry) => entry.domain_name));

let added = 0;
for (const domain of DOMAINS) {
  if (existingNames.has(domain)) {
    console.log(`[skip] ${domain} (already registered)`);
    continue;
  }
  try {
    const created = await stripe.paymentMethodDomains.create({ domain_name: domain });
    console.log(`[added] ${created.domain_name} (enabled=${created.enabled})`);
    added++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[error] ${domain}: ${message}`);
  }
}

try {
  const account = await stripe.accounts.retrieve();
  const currentUrl = account.business_profile?.url;
  if (currentUrl !== BUSINESS_PROFILE_URL) {
    await stripe.accounts.update(account.id, {
      business_profile: { url: BUSINESS_PROFILE_URL },
    });
    console.log(`[updated] business_profile.url: ${currentUrl || "(unset)"} → ${BUSINESS_PROFILE_URL}`);
  } else {
    console.log(`[skip] business_profile.url already ${BUSINESS_PROFILE_URL}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[warn] business_profile.url not updated (${message}). Set manually in Stripe Dashboard → Settings → Business details if needed.`);
}

const existingWebhooks = await stripe.webhookEndpoints.list({ limit: 100 });
const webhookByUrl = new Map(existingWebhooks.data.map((endpoint) => [endpoint.url, endpoint]));

let webhooksAdded = 0;
let webhooksUpdated = 0;
for (const url of WEBHOOK_URLS) {
  const existingEndpoint = webhookByUrl.get(url);
  if (!existingEndpoint) {
    try {
      const created = await stripe.webhookEndpoints.create({
        url,
        enabled_events: WEBHOOK_EVENTS,
        description: "Uncertain Systems app webhook",
      });
      console.log(`[added] webhook ${created.url}`);
      console.log(`        signing secret: ${created.secret} (set STRIPE_WEBHOOK_SECRET on Vercel if new)`);
      webhooksAdded++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[error] webhook ${url}: ${message}`);
    }
    continue;
  }

  const missingEvents = WEBHOOK_EVENTS.filter(
    (event) => !existingEndpoint.enabled_events.includes(event)
  );
  if (missingEvents.length === 0) {
    console.log(`[skip] webhook ${url} (already configured)`);
    continue;
  }

  try {
    const updated = await stripe.webhookEndpoints.update(existingEndpoint.id, {
      enabled_events: [...new Set([...existingEndpoint.enabled_events, ...WEBHOOK_EVENTS])],
    });
    console.log(`[updated] webhook ${updated.url} (+${missingEvents.length} event(s))`);
    webhooksUpdated++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[error] webhook ${url}: ${message}`);
  }
}

console.log(
  `Done. Domains added: ${added}. Webhooks added: ${webhooksAdded}, updated: ${webhooksUpdated}.`
);