/**
 * Upsert the Practice library catalog (quantum mechanics / computing).
 * Staging only. Refuses production.
 *
 * Usage:
 *   npm run db:seed-practice-problems
 */

import { connectTarget, loadEnvFile, projectRefFromUrl } from "./db-connection.mjs";
import {
  PRACTICE_QUANTUM_CATALOG_MARKER,
  PRACTICE_QUANTUM_PROBLEMS,
} from "../lib/practice-quantum-catalog";

function argTarget(argv: string[] = process.argv): "staging" {
  const raw = argv.find((arg) => arg.startsWith("--target="))?.slice("--target=".length);
  if (!raw || raw === "staging" || raw === "localhost" || raw === "local") return "staging";
  throw new Error(`Refusing target "${raw}". This seed is staging only.`);
}

async function main() {
  argTarget();
  const env = loadEnvFile(".env.local");
  const stagingUrl = String(
    env.STAGING_NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "",
  );
  const stagingRef = stagingUrl ? projectRefFromUrl(stagingUrl) : "";
  if (!stagingRef || stagingRef === "xzwjlkngxuxttvqbboea") {
    throw new Error("Refusing production project. This seed is staging only.");
  }

  console.log(`[seed-practice] marker=${PRACTICE_QUANTUM_CATALOG_MARKER}`);
  const { client, via } = await connectTarget("staging");
  console.log(`[seed-practice] connected via ${via} project=${stagingRef}`);

  try {
    let upserted = 0;
    for (const problem of PRACTICE_QUANTUM_PROBLEMS) {
      await client.query(
        `
        insert into public.practice_problems (
          slug, category, subcategory, title, prompt, sort_order, duration_minutes, published, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, true, now())
        on conflict (slug) do update set
          category = excluded.category,
          subcategory = excluded.subcategory,
          title = excluded.title,
          prompt = excluded.prompt,
          sort_order = excluded.sort_order,
          duration_minutes = excluded.duration_minutes,
          published = true,
          updated_at = now()
        `,
        [
          problem.slug,
          problem.category,
          problem.subcategory,
          problem.title,
          problem.prompt,
          problem.sortOrder,
          problem.durationMinutes,
        ],
      );
      upserted += 1;
    }
    const count = await client.query(
      `select count(*)::int as n from public.practice_problems where published = true`,
    );
    console.log(`[seed-practice] upserted=${upserted} published=${count.rows[0]?.n}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
