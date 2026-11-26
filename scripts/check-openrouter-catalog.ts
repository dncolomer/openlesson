/**
 * Merge gate: every AI-use catalog slug must advertise tools.
 * Uses tests/fixtures/openrouter-catalog.json unless OPENROUTER_LIVE_CATALOG=1.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AI_USE_CATALOG } from "../lib/region-simulation-ai-use-catalog";

type ModelRow = { id?: string; supported_parameters?: string[] };

function loadFixture(): ModelRow[] {
  const raw = readFileSync(join(process.cwd(), "tests/fixtures/openrouter-catalog.json"), "utf8");
  const parsed = JSON.parse(raw) as { data?: ModelRow[] };
  return parsed.data || [];
}

export function catalogRowsMissingTools(
  catalog: readonly { id: string; slug: string }[],
  models: readonly ModelRow[],
): string[] {
  const byId = new Map(models.map((row) => [String(row.id || ""), row] as const));
  const missing: string[] = [];
  for (const row of catalog) {
    const model = byId.get(row.slug);
    const params = model?.supported_parameters || [];
    if (!params.includes("tools")) missing.push(`${row.id} (${row.slug})`);
  }
  return missing;
}

async function main() {
  const models = loadFixture();
  const missing = catalogRowsMissingTools(AI_USE_CATALOG, models);
  if (missing.length) {
    console.error(`Catalog rows missing tools: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`OK ${AI_USE_CATALOG.length} catalog rows advertise tools`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("check-openrouter-catalog.ts")) {
  void main();
}
