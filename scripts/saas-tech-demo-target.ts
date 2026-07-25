/**
 * Shared CLI target selection for Helios / SaaS tech-team demo seed + verify.
 * Default is staging; production requires explicit --target=prod.
 */

export type SaasTechDemoTarget = "staging" | "prod";

/**
 * Parse --target=staging|prod from argv.
 * Omitting the flag (or --target=staging) → staging.
 * --target=prod|production → prod.
 * Any other value throws (never silent prod).
 */
export function parseSaasTechDemoSeedTarget(
  argv: string[] = process.argv,
): SaasTechDemoTarget {
  const raw = argv.find((a) => a.startsWith("--target="))?.slice("--target=".length);
  if (!raw || raw === "staging") return "staging";
  if (raw === "prod" || raw === "production") return "prod";
  throw new Error(
    `Refusing target "${raw}". Allowed: staging (default) or prod (explicit --target=prod).`,
  );
}
