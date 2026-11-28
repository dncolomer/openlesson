import { z } from "zod";

const optionalNonEmpty = z
  .string()
  .trim()
  .transform((v) => (v.length > 0 ? v : undefined))
  .optional();

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: optionalNonEmpty,
  NEXT_PUBLIC_SUPABASE_URL: optionalNonEmpty,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalNonEmpty,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalNonEmpty,
});

const serverEnvSchema = publicEnvSchema.extend({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmpty,
  XAI_API_KEY: optionalNonEmpty,
  AI_BASE_URL: optionalNonEmpty,
  AI_API_KEY: optionalNonEmpty,
  AI_MODEL: optionalNonEmpty,
  STRIPE_SECRET_KEY: optionalNonEmpty,
  STRIPE_WEBHOOK_SECRET: optionalNonEmpty,
  MCP_OAUTH_SECRET: optionalNonEmpty,
  LTI_COOKIE_SECRET: optionalNonEmpty,
  XAI_ORG_KEY_ENCRYPTION_SECRET: optionalNonEmpty,
  ORG_SECRETS_ENCRYPTION_KEY: optionalNonEmpty,
  CRON_SECRET: optionalNonEmpty,
  FLOWCFG_EMBEDDINGS_BASE_URL: optionalNonEmpty,
  FLOWCFG_EMBEDDINGS_API_KEY: optionalNonEmpty,
  WORKOS_API_KEY: optionalNonEmpty,
  WORKOS_CLIENT_ID: optionalNonEmpty,
  WORKOS_REDIRECT_URI: optionalNonEmpty,
  UPSTASH_REDIS_REST_URL: optionalNonEmpty,
  UPSTASH_REDIS_REST_TOKEN: optionalNonEmpty,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getPublicEnv(env: NodeJS.ProcessEnv = process.env): PublicEnv {
  return publicEnvSchema.parse(env);
}

export function getServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(env);
}

/**
 * Validate that a required set of environment variable names are populated.
 * Throws a single descriptive error listing all missing keys.
 */
export function assertEnvVars(
  keys: readonly (keyof ServerEnv)[],
  env: NodeJS.ProcessEnv = process.env,
): void {
  const parsed = getServerEnv(env);
  const missing = keys.filter((key) => !parsed[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}`,
    );
  }
}
