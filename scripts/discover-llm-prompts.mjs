#!/usr/bin/env node
/**
 * Discovers all LLM prompt call-site files in openlesson/.
 * Output: PROMPT_SCRATCH/prompt-call-sites.json (default: tests/fixtures/prompt-inventory)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH =
  process.env.PROMPT_SCRATCH ||
  path.join(ROOT, "tests/fixtures/prompt-inventory");

const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git"]);
const EXCLUDE_PATH_PARTS = ["/tests/", "/tests\\"];

const CALL_XAI = /callXai(?:JSON|Text|Responses)?(?:<[^>]*>)?\s*\(/;
const PROMPT_MARKERS =
  /getPrompt\s*\(|systemMessage\s*\(|userMessage\s*\(|instructions:\s*/;

/** Registry, builders, client-side prompts, and lib helpers without matched call pattern */
const SUPPLEMENTAL = [
  "lib/prompts.ts",
  "lib/local-inference.ts",
  "lib/labs-ai.ts",
  "lib/ghl-score-traces.ts",
  "lib/agent-v2/performance-report.ts",
  "lib/agent-v2/performance-context.ts",
  "lib/agent-v2/proof-of-work-schema.ts",
  "lib/agent-v2/integration-skill.ts",
  "lib/agent-v2/create-verification-workspace.ts",
  "lib/agent-v2/proof-of-work-integration.ts",
];

/** Routes that delegate to lib helpers (no inline prompt strings) */
const CONSUMER_PATHS = [
  "app/api/demo/workspace/route.ts",
  "app/api/demo/integration-skill/route.ts",
  "app/api/workspace/integration-skill/route.ts",
  "app/api/workspace/performance-report/route.ts",
  "app/api/v2/agent/workspaces/[id]/integration-skill/route.ts",
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (EXCLUDE_PATH_PARTS.some((p) => full.includes(p))) continue;
    out.push(full);
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

const allFiles = walk(ROOT);
const callSites = [];

for (const file of allFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (CALL_XAI.test(content) && PROMPT_MARKERS.test(content)) {
    callSites.push(rel(file));
  }
}

const supplemental = SUPPLEMENTAL.filter((p) => fs.existsSync(path.join(ROOT, p)));
const consumers = CONSUMER_PATHS.filter((p) => fs.existsSync(path.join(ROOT, p)));

const payload = {
  generated_at: new Date().toISOString(),
  root: ROOT,
  callSites: [...new Set(callSites)].sort(),
  supplemental: [...new Set(supplemental)].sort(),
  consumers: [...new Set(consumers)].sort(),
  allInventoryPaths: [
    ...new Set([...callSites, ...supplemental, ...consumers]),
  ].sort(),
};

fs.mkdirSync(SCRATCH, { recursive: true });
const outPath = path.join(SCRATCH, "prompt-call-sites.json");
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`Wrote ${outPath} (${payload.allInventoryPaths.length} paths)`);