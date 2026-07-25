#!/usr/bin/env node
/**
 * Builds prompt-inventory.json for the admin /prompts browser.
 * Run: node scripts/generate-prompt-inventory.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractAllEntries, extractDefaultPrompt } from "./prompt-extractors.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH = path.join(ROOT, "tests/fixtures/prompt-inventory");
const OUT = path.join(ROOT, "data/prompt-inventory.json");

const ACTIVE_KEYS = [
  "gap_detection",
  "opening_probe",
  "probe_generation",
  "report_generation",
  "follow_up_sessions",
  "generate_objectives",
  "session_plan_create",
  "session_plan_update",
];

const XAI_USAGE = {
  gap_detection: ["analyzeGap"],
  opening_probe: ["generateOpeningProbe"],
  probe_generation: ["generateProbe"],
  report_generation: ["generateReport"],
  follow_up_sessions: ["generateFollowUpSessions"],
  generate_objectives: ["generateObjectives"],
  session_plan_create: ["createSessionPlanLLM"],
  session_plan_update: ["updateSessionPlanLLM"],
};

const CONSUMER_DELEGATES = {
  "app/api/workspace/integration-skill/route.ts":
    "lib/pow-api/integration-skill.ts → buildIntegrationSkillInstructions",
  "app/api/workspace/performance-report/route.ts":
    "lib/pow-api/performance-report.ts → buildPerformanceReportInstructions",
  "app/api/v3/pow/workspaces/[id]/integration-skill/route.ts":
    "lib/pow-api/integration-skill.ts → buildIntegrationSkillInstructions",
};

const SKIP_PATHS = new Set(["lib/xai-client.ts"]);

const DOMAINS = [
  {
    id: "registry",
    label: "Central Registry",
    description:
      "DEFAULT_PROMPTS in lib/prompts.ts — loaded via getPrompt() in lib/xai.ts and API routes. User overrides live in profiles.metadata.prompts.",
    order: 1,
  },
  {
    id: "session-helios",
    label: "Session / Helios",
    description:
      "ILE tutoring: session chat, welcome messages, feedback generation, and session performance chat.",
    order: 2,
  },
  {
    id: "heartbeat-session-plan",
    label: "Heartbeat & Session Plan",
    description:
      "Session plan creation/update, plan translation, and agent/plan routing.",
    order: 3,
  },
  {
    id: "workspace-api",
    label: "Workspace & Learning Plan",
    description:
      "Verification workspace generation, grid helpers, prep material, remix, and workspace chat flows.",
    order: 4,
  },
  {
    id: "tap-ghc-scoring",
    label: "TAP / GHC Scoring",
    description:
      "Think Aloud Protocol scoring, GHC chat overlays, trace scoring, and workspace score completion routes.",
    order: 5,
  },
  {
    id: "pow-api",
    label: "Agent v2",
    description:
      "Proof-of-work schema, integration skills, performance reports, verification workspace builders, and PoW/Eval API routes.",
    order: 6,
  },
  {
    id: "insights-rabbit-hole",
    label: "Insights & Rabbit Hole",
    description: "Insight creation and rabbit-hole interview/continue flows.",
    order: 7,
  },
  {
    id: "client-local-ai",
    label: "Client / Local AI",
    description: "Browser-side labs AI and local HuggingFace inference prompts.",
    order: 8,
  },
  {
    id: "misc",
    label: "Misc",
    description: "Other inline prompts not covered above.",
    order: 9,
  },
];

function classifyDomain(relPath, symbol, kind) {
  if (kind === "registry" || relPath === "lib/prompts.ts" || relPath === "lib/xai.ts") {
    return "registry";
  }
  if (
    relPath.includes("session-chat") ||
    relPath === "app/api/session/performance-chat/route.ts"
  ) {
    return "session-helios";
  }
  if (
    relPath.includes("session-plan") ||
    relPath.includes("agent/plan") ||
    symbol?.includes("session_plan")
  ) {
    return "heartbeat-session-plan";
  }
  if (
    relPath.includes("app/api/workspace/") ||
    relPath.includes("app/api/workspaces/") ||
    relPath.includes("prep-material") ||
    relPath.includes("suggest-plan-topic") ||
    relPath.includes("suggest-grokipedia")
  ) {
    return "workspace-api";
  }
  if (
    relPath.includes("workspace-tap") ||
    relPath === "lib/tap-score.ts" ||
    relPath === "lib/tap-score-traces.ts"
  ) {
    return "tap-scoring";
  }
  if (
    relPath.includes("pow-api") ||
    relPath.includes("v3/pow") ||
    relPath.includes("demo/")
  ) {
    return "pow-api";
  }
  if (relPath.includes("rabbit-hole") || relPath.includes("insights")) {
    return "insights-rabbit-hole";
  }
  if (relPath === "lib/local-inference.ts" || relPath === "lib/labs-ai.ts") {
    return "client-local-ai";
  }
  return "misc";
}

function extractPromptMeta(src) {
  const meta = {};
  const block = src.slice(src.indexOf("export const PROMPT_META"));
  const re = /(\w+):\s*\{\s*label:\s*"([^"]*)",\s*description:\s*"([^"]*)",?\s*\}/g;
  let m;
  while ((m = re.exec(block))) {
    meta[m[1]] = { label: m[2], description: m[3] };
  }
  return meta;
}

function extractIleContext(src) {
  const m = src.match(/export const ILE_CONTEXT = `\n?([\s\S]*?)`\.trim\(\)/);
  return m ? m[1].trim() : null;
}

function extractDefaultPromptKeys(src) {
  const keys = [];
  const re = /^\s{2}(\w+):\s*`/gm;
  let m;
  while ((m = re.exec(src.slice(src.indexOf("export const DEFAULT_PROMPTS"))))) {
    keys.push(m[1]);
  }
  return keys;
}

function slugId(file, symbol) {
  return `${file}::${symbol}`.replace(/[^a-zA-Z0-9:_\-\[\]]/g, "-");
}

function loadCallSites() {
  const sitesPath = path.join(SCRATCH, "prompt-call-sites.json");
  if (!fs.existsSync(sitesPath)) {
    throw new Error(`Missing ${sitesPath}. Run: node scripts/discover-llm-prompts.mjs`);
  }
  return JSON.parse(fs.readFileSync(sitesPath, "utf8"));
}

function buildRegistryEntries(promptsSrc) {
  const meta = extractPromptMeta(promptsSrc);
  const keys = extractDefaultPromptKeys(promptsSrc);
  const entries = [];

  const ile = extractIleContext(promptsSrc);
  if (ile) {
    entries.push({
      id: slugId("lib/prompts.ts", "ILE_CONTEXT"),
      domainId: "registry",
      file: "lib/prompts.ts",
      symbol: "ILE_CONTEXT",
      kind: "context",
      label: "ILE Context",
      description: "Shared Helios / ILE environment context appended to session prompts.",
      text: ile,
      charCount: ile.length,
    });
  }

  for (const key of keys) {
    const text = extractDefaultPrompt(promptsSrc, key);
    if (!text) continue;
    const m = meta[key] || { label: key, description: "" };
    entries.push({
      id: slugId("lib/prompts.ts", key),
      domainId: "registry",
      file: "lib/prompts.ts",
      symbol: key,
      kind: "registry",
      status: ACTIVE_KEYS.includes(key) ? "active" : "legacy",
      label: m.label,
      description: m.description,
      usedBy: XAI_USAGE[key] || [],
      text,
      charCount: text.length,
    });
  }

  return entries;
}

function buildConsumerEntries(relPath) {
  const delegate = CONSUMER_DELEGATES[relPath];
  if (!delegate) {
    return [
      {
        id: slugId(relPath, "consumer"),
        domainId: classifyDomain(relPath, "consumer", "consumer"),
        file: relPath,
        symbol: "(consumer)",
        kind: "consumer",
        label: path.basename(relPath, ".ts"),
        description: "Delegates to a lib builder — no inline prompt strings.",
        delegatesTo: "See related lib/pow-api files",
        text: "This route does not define prompt text inline. It calls a shared builder in lib/.",
        charCount: 0,
      },
    ];
  }

  return [
    {
      id: slugId(relPath, "consumer"),
      domainId: classifyDomain(relPath, "consumer", "consumer"),
      file: relPath,
      symbol: "(consumer)",
      kind: "consumer",
      label: path.basename(relPath, ".ts"),
      description: "API route that delegates prompt construction to a lib helper.",
      delegatesTo: delegate,
      text: `Consumer route — prompts defined in:\n${delegate}`,
      charCount: delegate.length,
    },
  ];
}

function main() {
  const { allInventoryPaths, consumers, generated_at: sitesGeneratedAt } = loadCallSites();
  const consumerSet = new Set(consumers);
  const entries = [];
  const seenIds = new Set();

  function push(entry) {
    if (seenIds.has(entry.id)) return;
    seenIds.add(entry.id);
    entries.push(entry);
  }

  const promptsPath = path.join(ROOT, "lib/prompts.ts");
  const promptsSrc = fs.readFileSync(promptsPath, "utf8");
  for (const e of buildRegistryEntries(promptsSrc)) push(e);

  for (const relPath of allInventoryPaths) {
    if (SKIP_PATHS.has(relPath) || relPath === "lib/prompts.ts") continue;

    if (consumerSet.has(relPath)) {
      for (const e of buildConsumerEntries(relPath)) push(e);
      continue;
    }

    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs)) continue;
    const src = fs.readFileSync(abs, "utf8");
    const extracted = extractAllEntries(src, relPath);

    if (extracted.length === 0 && relPath === "lib/xai.ts") {
      push({
        id: slugId(relPath, "getPrompt-wiring"),
        domainId: "registry",
        file: relPath,
        symbol: "getPrompt() wiring",
        kind: "consumer",
        label: "xAI domain helpers",
        description: "High-level wrappers that load registry prompts via getPrompt().",
        text: ACTIVE_KEYS.map(
          (k) => `${k} → ${(XAI_USAGE[k] || []).join(", ") || "—"}`,
        ).join("\n"),
        charCount: 0,
      });
      continue;
    }

    for (const { symbol, text } of extracted) {
      const kind =
        symbol.startsWith("build") || symbol.includes("Instructions")
          ? "builder"
          : relPath.includes("createVerification")
            ? "builder"
            : "inline";
      push({
        id: slugId(relPath, symbol),
        domainId: classifyDomain(relPath, symbol, kind),
        file: relPath,
        symbol,
        kind,
        text,
        charCount: text.length,
      });
    }
  }

  entries.sort((a, b) => {
    const da = DOMAINS.find((d) => d.id === a.domainId)?.order ?? 99;
    const db = DOMAINS.find((d) => d.id === b.domainId)?.order ?? 99;
    if (da !== db) return da - db;
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.symbol.localeCompare(b.symbol);
  });

  const payload = {
    version: 1,
    generated_at: new Date().toISOString(),
    call_sites_generated_at: sitesGeneratedAt,
    path_count: allInventoryPaths.length,
    entry_count: entries.length,
    domains: DOMAINS,
    entries,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${OUT} (${entries.length} entries, ${allInventoryPaths.length} paths)`);
}

main();