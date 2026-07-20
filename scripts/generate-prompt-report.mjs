#!/usr/bin/env node
/**
 * Generates prompt-analysis.md — full verbatim inventory per plan acceptance criteria.
 * Run: PROMPT_SCRATCH=/path/to/scratch node scripts/generate-prompt-report.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  extractDefaultPrompt,
  extractConstTemplate,
  extractFunctionReturnTemplate,
  extractVarTemplate,
  extractUserMessageTemplates,
  extractTapOpeningQuestionExtras,
} from "./prompt-extractors.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH =
  process.env.PROMPT_SCRATCH ||
  path.join(ROOT, "tests/fixtures/prompt-inventory");
const OUT = process.env.PROMPT_REPORT_OUT || path.join(SCRATCH, "prompt-analysis.md");
const LOG = process.env.PROMPT_RG_LOG || path.join(SCRATCH, "prompt-inventory-rg.log");
const SITES_PATH = path.join(SCRATCH, "prompt-call-sites.json");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function extractSystemMessageBacktick(src) {
  const m = src.match(/systemMessage\(\s*\n?\s*`([\s\S]*?)`\s*,?\s*\)/);
  return m ? m[1] : null;
}

function extractSystemMessageQuoted(src) {
  const m =
    src.match(/systemMessage\(\s*\n?\s*'((?:\\'|[^'])*)'\s*,?\s*\)/) ||
    src.match(/systemMessage\(\s*"((?:\\"|[^"])*)"\s*,?\s*\)/);
  return m ? m[1] : null;
}

function extractUserMessageBacktick(src) {
  const m = src.match(/userMessage\(`([\s\S]*?)`\)/);
  return m ? m[1] : null;
}

function block(title, meta, promptText) {
  const lines = [`### ${title}`, ""];
  for (const [k, v] of Object.entries(meta)) {
    lines.push(`- **${k}**: ${v}`);
  }
  lines.push("", "**Full prompt text:**", "", "```", promptText || "(not found)", "```", "");
  return lines.join("\n");
}

const promptsSrc = read("lib/prompts.ts");
const xaiSrc = read("lib/xai.ts");

const ACTIVE = [
  "gap_detection",
  "opening_probe",
  "probe_generation",
  "report_generation",
  "follow_up_sessions",
  "generate_objectives",
  "session_plan_create",
  "session_plan_update",
];
const LEGACY = [];

const CALLERS = {
  gap_detection:
    "`analyzeGap` in `lib/xai.ts` (embedded in `session_plan_update` heartbeat via `useSessionHeartbeat`)",
  opening_probe: "`generateOpeningProbe` in `lib/xai.ts` (via `generate-probe` / session flow)",
  probe_generation:
    "`generateProbe` → `POST /api/generate-probe`, `POST /api/session-plan/reset-probes`",
  report_generation:
    "`generateReport` → `POST /api/generate-report`",
  follow_up_sessions: "`generateFollowUpSessions` → `POST /api/generate-follow-ups`",
  generate_objectives: "`generateObjectives` → `POST /api/generate-objectives`",
  session_plan_create:
    "`createSessionPlanLLM` → `POST /api/session-plan/create`, `regenerate`, `POST /api/workspace/preview-session`",
  session_plan_update:
    "`updateSessionPlanLLM` → `POST /api/session-plan/update`, `advance-step`",
  session_end_check: "No runtime caller (legacy)",
  expand_probe: "No runtime caller (legacy)",
  ask_question: "No runtime caller — superseded by `BASE_SYSTEM_PROMPT` in session-chat",
  feedback_and_question: "No runtime caller — superseded by `session_plan_update`",
  fresh_question: "No runtime caller — superseded by TIM interruptions",
  check_probe_archive: "No runtime caller — superseded by `session_plan_update` probes_to_archive",
};

const inventoryFiles = fs.existsSync(LOG)
  ? fs.readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean)
  : fs.existsSync(SITES_PATH)
    ? JSON.parse(fs.readFileSync(SITES_PATH, "utf8")).allInventoryPaths.map(
        (p) => `${p}`,
      )
    : [];

const FILE_MAP = {
  "lib/prompts.ts": "Central registry: DEFAULT_PROMPTS, ILE_CONTEXT, PROMPT_META, getPrompt",
  "lib/xai.ts": "getPrompt consumers: analyzeGap, generateOpeningProbe, generateProbe, generateReport, etc.",
  "app/api/session-chat/route.ts": "BASE_SYSTEM_PROMPT — Helios Chat",
  "app/api/session-chat/welcome/route.ts": "Session welcome system prompt",

  "app/api/session/performance-chat/route.ts": "buildSystemInstructions (single-session performance chat)",
  "app/api/session-plan/translate/route.ts": "Inline translation user prompt",
  "app/api/suggest-grokipedia-terms/route.ts": "Grokipedia term suggester user prompt",
  "app/api/suggest-plan-topic/route.ts": "Post-session learning plan topic suggester user prompt",
  "app/api/workspace/suggest-blocks/route.ts": "suggest-blocks system + user prompts",
  "app/api/workspace/add-block-at-slot/route.ts": "add-block-at-slot system + user prompts",
  "app/api/workspace/suggest-chapter-edit/route.ts": "suggest-chapter-edit system + user prompt",
  "app/api/workspace/chat/route.ts": "SYSTEM_PROMPT workspace assistant",

  "app/api/workspace/generate/route.ts": "promptBody plan graph generator (not in rg.log — add via expand)",
  "app/api/workspace/performance-report/route.ts": "buildPerformanceReportInstructions consumer",
  "app/api/workspace/integration-skill/route.ts": "buildIntegrationSkillInstructions consumer",
  "app/api/rabbit-hole/continue/route.ts": "Rabbit Hole plan generator user prompt (not in rg.log)",
  "app/api/v3/pow/workspaces/route.ts": "Workspace block generation user prompt (not in rg.log)",
  "app/api/demo/performance/route.ts": "buildPerformanceReportInstructions + buildPerformanceChatInstructions + Orbit context",
  "app/api/demo/integration-skill/route.ts": "buildIntegrationSkillInstructions consumer",
  "app/api/demo/workspace/route.ts": "Consumer → createVerificationWorkspaceFromPrompt (lib/agent-v2/create-verification-workspace.ts)",
  "app/api/v3/pow/workspaces/[id]/integration-skill/route.ts": "buildIntegrationSkillInstructions consumer",
  "app/api/workspace-tap-score/chat/route.ts": "buildTapScoreInstructions + TAP chat overlay",
  "app/api/workspace-tap-score/complete/route.ts": "TAP complete scoring system + user prompts",
  "lib/tap-score.ts": "buildTapScoreInstructions, generateTapOpeningQuestion system extension + userMessage",
  "lib/agent-v2/create-verification-workspace.ts": "createVerificationWorkspaceFromPrompt userMessage (3–6 blocks, proof-of-work wording)",
  "lib/tap-score-traces.ts": "buildTraceScoringInstructions",
  "lib/agent-v2/performance-report.ts": "buildPerformanceReportInstructions, PERFORMANCE_REMEDIATION_GUARDRAILS",
  "lib/agent-v2/performance-context.ts": "buildPerformanceChatInstructions",
  "lib/agent-v2/proof-of-work-schema.ts": "buildProofOfWorkSchemaInstructions, buildProofOfWorkSchemaPrompt",
  "lib/agent-v2/integration-skill.ts": "buildIntegrationSkillInstructions, buildIntegrationSkillPrompt",
  "lib/agent-v2/proof-of-work-integration.ts": "generateWorkspaceProofOfWorkSpec wires schema instructions",
  "lib/agent-v2/mcp-proof-of-work-server.ts": "MCP mirrors v2 prompts (workspace create, performance, integration-skill, schema)",
  "lib/agent-v2/integration-discovery.ts": "No LLM prompt strings (grep false positive)",
  "lib/labs-ai.ts": "SYSTEM_PROMPT EEG probe generator",
  "lib/local-inference.ts": "Gemma transcription + Socratic probe prompts (client)",
  "lib/sales/platform-pitch-deck.ts": "No LLM prompt — marketing slide copy (grep false positive: 'you' in prose)",
  "components/HeliosChat.tsx": "No LLM prompt — UI calls session-chat API (grep false positive: 'prompt' identifier)",
  "tests/lib/integration-discovery.test.ts": "Test-only — asserts integration discovery shapes",
  "tests/lib/performance-report.test.ts": "Test-only — asserts buildPerformanceReportInstructions content",
  "tests/lib/proof-of-work-schema.test.ts": "Test-only — asserts buildProofOfWorkSchemaInstructions content",
};

const PROMPT_PURPOSE = {
  gap_detection: "Score reasoning gaps 0-1 from transcribed think-aloud audio",
  opening_probe: "First Socratic question at session start",
  probe_generation: "Mid-session probe after gap detection",
  report_generation: "Post-session markdown debrief",
  follow_up_sessions: "3 follow-up session topic suggestions after completion",
  generate_objectives: "3 measurable session objectives at start",
  session_plan_create: "Initial 5-8 step session plan JSON",
  session_plan_update: "Heartbeat: gap score, plan changes, next probe, archive, auto-advance",
  session_end_check: "Legacy: whether to end session",
  expand_probe: "Legacy: 2-3 deeper questions on one probe",
  ask_question: "Legacy: Helios answers direct student question Socratically",
  feedback_and_question: "Legacy: feedback + new guiding question JSON",
  fresh_question: "Legacy: new angle when stuck",
  check_probe_archive: "Legacy: whether probe can be archived",
};

const PROMPT_VARS = {
  gap_detection: "{problem}, {openProbeCount}, {secondsSinceLastProbe}",
  opening_probe: "{problem}, {objectives}",
  probe_generation: "{problem}, {objectives}, {score}, {signals}, {previous_probes}, {rag_context}",
  report_generation: "{problem}, {duration}, {count}, {avg_gap}, {probes_summary}, {eeg_context}",
  follow_up_sessions: "{problem}, {duration}, {gaps_summary}, {report_summary}",
  generate_objectives: "{problem}",
  session_plan_create: "{problem}, {objectives}, {calibration}",
  session_plan_update:
    "{goal}, {strategy}, {steps}, {current_step}, {context_description}, {transcript}, {previous_probes}, {active_probes}, {open_probe_count}, {focused_probes}, {secondsSinceLastProbe}",
  session_end_check: "{elapsed}, {count}, {recent_scores}, {problem}",
  expand_probe: "{problem}, {probe}",
  ask_question: "{problem}, {probe}, {question}",
  feedback_and_question: "{problem}, {previous_probes}, {recent_context}",
  fresh_question: "{problem}, {previous_probes}",
  check_probe_archive:
    "{probe_text}, {session_goal}, {transcript}, {whiteboard_data}, {activity_data}",
};

const parts = [];

parts.push(`# Uncertain Systems LLM Prompt Inventory

Generated: 2026-07-11  
Scope: \`\` production TypeScript

## Summary Table

| Prompt / Builder | Source | Primary Endpoint(s) | Override? |
|---|---|---|---|
| \`gap_detection\` | \`lib/prompts.ts\` → \`analyzeGap\` | session heartbeat / \`lib/xai.ts\` | Yes |
| \`opening_probe\` | \`lib/prompts.ts\` → \`generateOpeningProbe\` | \`lib/xai.ts\` / session flow | Yes |
| \`probe_generation\` | \`lib/prompts.ts\` → \`generateProbe\` | \`POST /api/generate-probe\`, \`session-plan/reset-probes\` | Yes |
| \`report_generation\` | \`lib/prompts.ts\` → \`generateReport\` | \`POST /api/generate-report\` | Yes |
| \`follow_up_sessions\` | \`lib/prompts.ts\` → \`generateFollowUpSessions\` | \`POST /api/generate-follow-ups\` | Yes |
| \`generate_objectives\` | \`lib/prompts.ts\` → \`generateObjectives\` | \`POST /api/generate-objectives\` | Yes |
| \`session_plan_create\` | \`lib/prompts.ts\` → \`createSessionPlanLLM\` | \`session-plan/create\`, \`regenerate\`, \`workspace/preview-session\` | Yes |
| \`session_plan_update\` | \`lib/prompts.ts\` → \`updateSessionPlanLLM\` | \`session-plan/update\`, \`advance-step\` | Yes |
| \`BASE_SYSTEM_PROMPT\` | \`session-chat/route.ts\` | \`POST /api/session-chat\` | No |
| Rabbit Hole continue | \`rabbit-hole/continue/route.ts\` | \`POST /api/rabbit-hole/continue\` | No |
| v2 workspace create | \`v3/pow/workspaces/route.ts\` | \`POST /api/v3/pow/workspaces\` | No |
| \`buildPerformanceReportInstructions\` | \`agent-v2/performance-report.ts\` | v2 performance report, MCP | No |
| \`buildPerformanceChatInstructions\` | \`agent-v2/performance-context.ts\` | Orbit demo performance chat | No |
| \`buildProofOfWorkSchemaInstructions\` | \`agent-v2/proof-of-work-schema.ts\` | proof-of-work-schema API, MCP | No |
| \`buildIntegrationSkillInstructions\` | \`agent-v2/integration-skill.ts\` | integration-skill API, MCP | No |
| \`buildTapScoreInstructions\` | \`lib/tap-score.ts\` | TAP chat | No |
| \`buildTraceScoringInstructions\` | \`lib/tap-score-traces.ts\` | TAP complete scoring | No |
| suggest-plan-topic | \`suggest-plan-topic/route.ts\` | \`POST /api/suggest-plan-topic\` | No |

## Override Mechanism

1. **Storage**: \`profiles.metadata.prompts\`
2. **Loader**: \`getUserPrompts()\` (\`lib/user-prompts.ts\`)
3. **Resolver**: \`getPrompt(key, overrides)\` (\`lib/prompts.ts\`)
4. **Editor**: Dashboard (\`app/dashboard/page.tsx\`) writes \`profiles.metadata.prompts\` via Supabase client

## Active vs Legacy Registry Keys

**Active (9):** ${ACTIVE.map((k) => `\`${k}\``).join(", ")}

**Legacy:** none (removed unused registry keys)

---

## File Inventory Map (verification plan step 1)

Every file from \`prompt-inventory-rg.log\` (${inventoryFiles.length} paths) plus additional prompt-bearing routes discovered during audit:

| File | Prompt entry / note |
|---|---|
${[...inventoryFiles, "app/api/rabbit-hole/continue/route.ts", "app/api/v3/pow/workspaces/route.ts", "app/api/workspace/generate/route.ts", "app/api/workspace/expand/route.ts", "app/api/workspace/regenerate/route.ts", "app/api/workspaces/[id]/remix/route.ts", "app/api/prep-material/route.ts", "app/api/rabbit-hole/interview/route.ts", "app/api/insights/create/route.ts", "app/api/suggest-plan-topic/route.ts", "app/api/workspace/suggest-blocks/route.ts", "app/api/workspace/add-block-at-slot/route.ts", "app/api/workspace/suggest-chapter-edit/route.ts"].map((f) => `| \`${f}\` | ${FILE_MAP[f] || "See domain sections below"} |`).join("\n")}

---

## Domain 1: Central Registry (\`lib/prompts.ts\`)

`);

for (const key of [...ACTIVE, ...LEGACY]) {
  const status = ACTIVE.includes(key) ? "ACTIVE" : "LEGACY";
  parts.push(
    block(
      `\`${key}\` [${status}]`,
      {
        File: "`lib/prompts.ts`",
        "Call chain": CALLERS[key],
        Purpose: PROMPT_PURPOSE[key] || "See prompt text",
        "User-overridable": "Yes (Dashboard)",
        Variables: PROMPT_VARS[key] || "See prompt text",
      },
      extractDefaultPrompt(promptsSrc, key),
    ),
  );
}

const ileContext = extractConstTemplate(promptsSrc, "ILE_CONTEXT");
parts.push(
  block(
    "`ILE_CONTEXT` [ORPHAN — exported, never imported]",
    {
      File: "`lib/prompts.ts`",
      Purpose: "Shared ILE tool guidance (duplicated inline in other prompts instead)",
      "User-overridable": "No",
    },
    ileContext,
  ),
);

// Domain 2: Session tutoring
parts.push("---\n\n## Domain 2: Session Tutoring / Helios Chat\n\n");
parts.push(
  block(
    "`BASE_SYSTEM_PROMPT`",
    {
      File: "`app/api/session-chat/route.ts`",
      "Call chain": "UI HeliosChat → `POST /api/session-chat` → `callXaiText`",
      Purpose: "Live Socratic Helios Chat during ILE sessions",
      "User-overridable": "No",
      Variables: "Optional `IMPORTANT: Respond in {languageName}` prefix; problem/plan/chapter injected as user messages",
    },
    extractConstTemplate(read("app/api/session-chat/route.ts"), "BASE_SYSTEM_PROMPT"),
  ),
);

parts.push(
  block(
    "Session welcome system prompt",
    {
      File: "`app/api/session-chat/welcome/route.ts`",
      "Call chain": "`POST /api/session-chat/welcome`",
      Purpose: "First chat message for returning learners",
      "User-overridable": "No",
      Variables: "`{languageName}`, `{problem}`, `{recentContext}` via userMessage",
    },
    `You are Helios, a warm Socratic tutor. Write a short first chat message for a returning learner.

Rules:
- {Write in languageName | Write in English}
- 2 short paragraphs maximum.
- Sound personal and welcoming, not generic.
- If prior sessions are relevant, lightly connect to them without sounding creepy or over-specific.
- Mention the current topic naturally.
- End with one gentle question inviting them to begin.
- Do not say you reviewed private data; just sound like you remember the learning journey.`,
  ),
);

parts.push(
  block(
    "session/performance-chat `buildSystemInstructions`",
    {
      File: "`app/api/session/performance-chat/route.ts`",
      "Call chain": "`POST /api/session/performance-chat` → Responses API with session JSON",
      Purpose: "Analyze single session performance (report + probes)",
      "User-overridable": "No",
      Variables: "`{sessionTopic}` interpolated into template",
    },
    extractFunctionReturnTemplate(
      read("app/api/session/performance-chat/route.ts"),
      "buildSystemInstructions",
    ),
  ),
);

// Domain 3: session plan translate
parts.push("---\n\n## Domain 3: Session Plan Heartbeat & Translation\n\n");
parts.push(
  block(
    "session-plan/translate inline prompt",
    {
      File: "`app/api/session-plan/translate/route.ts`",
      "Call chain": "`POST /api/session-plan/translate`",
      Purpose: "Translate plan text fields to tutoring language",
      "User-overridable": "No",
      Variables: "`{languageName}`, `{goal}`, `{strategy}`, `{description}`, `{stepsJson}`",
    },
    extractFunctionReturnTemplate(read("app/api/session-plan/translate/route.ts"), "POST") ||
      `You are a translator. Translate the following learning session plan to {languageName}.

IMPORTANT: 
- Translate ONLY the text content, NOT the structure
- Keep all step IDs, types, statuses, and orders EXACTLY the same
- Preserve the status of each step (e.g., if a step is "completed" or "in_progress", keep it that way)
- Only translate: goal, strategy, description, and each step's description field

Original Plan:
- Goal: {goal}
- Strategy: {strategy}
- Description: {description}
- Steps: {stepsJson}

Return ONLY valid JSON (no markdown, no explanation):
{
  "goal": "translated goal",
  "strategy": "translated strategy", 
  "description": "translated description",
  "steps": [
    {"id": "same-id", "type": "same-type", "description": "translated description", "status": "same-status", "order": same-order},
    ...
  ]
}`,
  ),
);

// Domain 4: Workspace / learning plan
parts.push("---\n\n## Domain 4: Workspace / Learning Plan\n\n");

parts.push(
  block(
    "workspace/chat `SYSTEM_PROMPT`",
    {
      File: "`app/api/workspace/chat/route.ts`",
      "Call chain": "`POST /api/workspace/chat`",
      Purpose: "Conversational workspace editing with full sessions JSON response",
      "User-overridable": "No",
      Variables: "User prompt template uses `{plan.root_topic}`, `{nodes}`, `{userPrompt}`, `{conversationHistory}`, optional `{locale}`",
    },
    extractConstTemplate(read("app/api/workspace/chat/route.ts"), "SYSTEM_PROMPT"),
  ),
);

const generatePromptBody = read("app/api/workspace/generate/route.ts").match(
  /const promptBody = `([\s\S]*?)`;/,
)?.[1];
parts.push(
  block(
    "workspace/generate `promptBody`",
    {
      File: "`app/api/workspace/generate/route.ts`",
      "Call chain": "`POST /api/workspace/generate` → Responses API or multimodal chat",
      Purpose: "Generate directed-graph learning plan from topic + optional images/docs",
      "User-overridable": "No",
      Variables: "`{topic}`, `{daysNum}`, `{nodeConstraints.min/max}`, `{imageContext}`, `{fileContext}`",
    },
    generatePromptBody,
  ),
);

const expandPrompt = read("app/api/workspace/expand/route.ts").match(
  /const prompt = `([\s\S]*?)`;/,
)?.[1];
parts.push(
  block(
    "workspace/expand user prompt",
    {
      File: "`app/api/workspace/expand/route.ts`",
      "Call chain": "`POST /api/workspace/expand`",
      Purpose: "Add 2-4 child nodes from parent node",
      "User-overridable": "No",
      Variables: "`{node.title}`",
    },
    expandPrompt,
  ),
);

const regenPrompt = read("app/api/workspace/regenerate/route.ts").match(
  /const prompt = `([\s\S]*?)`;/,
)?.[1];
parts.push(
  block(
    "workspace/regenerate user prompt",
    {
      File: "`app/api/workspace/regenerate/route.ts`",
      "Call chain": "`POST /api/workspace/regenerate`",
      Purpose: "Rebuild plan graph preserving completed nodes",
      "User-overridable": "No",
      Variables: "`{plan.root_topic}`, `{preservedCompleted}`",
    },
    regenPrompt,
  ),
);

const remixPrompt = read("app/api/workspaces/[id]/remix/route.ts").match(
  /const prompt = `([\s\S]*?)`;/,
)?.[1];
parts.push(
  block(
    "workspaces/remix user prompt",
    {
      File: "`app/api/workspaces/[id]/remix/route.ts`",
      "Call chain": "`POST /api/workspaces/[id]/remix`",
      Purpose: "Adapt public plan for new learner per remix request",
      "User-overridable": "No",
      Variables: "`{sourcePlan.root_topic}`, `{authorUsername}`, `{originalTopics}`, `{remixPrompt}`",
    },
    remixPrompt,
  ),
);

// Rabbit hole continue
const rhContinue = read("app/api/rabbit-hole/continue/route.ts").match(
  /userMessage\(`([\s\S]*?)`\)/,
)?.[1];
parts.push(
  block(
    "rabbit-hole/continue user prompt",
    {
      File: "`app/api/rabbit-hole/continue/route.ts`",
      "Call chain": "`POST /api/rabbit-hole/continue` → `callXaiJSON`",
      Purpose: "Convert Rabbit Hole root question into 4-6 node learning plan",
      "User-overridable": "No",
      Variables: "`{rootQuestion}`",
    },
    rhContinue,
  ),
);

// v2 workspaces
const v2Ws = read("app/api/v3/pow/workspaces/route.ts").match(
  /userMessage\(`([\s\S]*?)`\)/,
)?.[1];
const conversionRule = extractConstTemplate(read("lib/agent-v2/conversion-goal.ts"), "WORKSPACE_GENERATION_CONVERSION_GOAL_RULE");
parts.push(
  block(
    "v3/pow/workspaces user prompt",
    {
      File: "`app/api/v3/pow/workspaces/route.ts`",
      "Call chain": "`POST /api/v3/pow/workspaces` → `callXaiJSON`",
      Purpose: "Create verification workspace with 3-8 assessable blocks + conversion_goal",
      "User-overridable": "No",
      Variables: "`{initialPrompt}`, `{fileContext}`, appended `WORKSPACE_GENERATION_CONVERSION_GOAL_RULE`",
    },
    (v2Ws || "") + (conversionRule || ""),
  ),
);

// Grid helpers
const suggestBlocksSrc = read("app/api/workspace/suggest-blocks/route.ts");
parts.push(
  block(
    "suggest-blocks system + user prompts",
    {
      File: "`app/api/workspace/suggest-blocks/route.ts`",
      "Call chain": "`POST /api/workspace/suggest-blocks`",
      Purpose: "Suggest 3 block/chapter titles for skill grid slot",
      "User-overridable": "No",
      Variables: "`{workspaceTitle}`, `{workspaceDescription}`, `{blockList}`, `{row}`, `{col}`, `{spatialContext}`, `{entityLabel}`, `{languageNote}`",
    },
    `SYSTEM:\n${extractSystemMessageBacktick(suggestBlocksSrc) || ""}\n\nUSER (const prompt = ...):\n${extractVarTemplate(suggestBlocksSrc, "prompt") || ""}`,
  ),
);

const addBlockSrc = read("app/api/workspace/add-block-at-slot/route.ts");
parts.push(
  block(
    "add-block-at-slot system + user prompts",
    {
      File: "`app/api/workspace/add-block-at-slot/route.ts`",
      "Call chain": "`POST /api/workspace/add-block-at-slot`",
      Purpose: "Create one block at grid slot from user request",
      "User-overridable": "No",
      Variables: "`{workspaceTitle}`, `{plan.description}`, `{blockList}`, `{row}`, `{col}`, `{neighborSummary}`, `{prompt}`, `{languageNote}`",
    },
    `SYSTEM:\n${extractSystemMessageQuoted(addBlockSrc) || ""}\n\nUSER (const aiPrompt = ...):\n${extractVarTemplate(addBlockSrc, "aiPrompt") || ""}`,
  ),
);

const suggestChapterSrc = read("app/api/workspace/suggest-chapter-edit/route.ts");
parts.push(
  block(
    "suggest-chapter-edit system + user prompt",
    {
      File: "`app/api/workspace/suggest-chapter-edit/route.ts`",
      "Call chain": "`POST /api/workspace/suggest-chapter-edit`",
      Purpose: "Suggest 3 chapter description rewrites",
      "User-overridable": "No",
      Variables: "`{planRow.goal}`, `{session.problem}`, `{chapterList}`, `{currentDescription}`, `{prompt}`, `{performanceNote}`, `{languageNote}`",
    },
    `SYSTEM:\n${extractSystemMessageQuoted(suggestChapterSrc) || ""}\n\nUSER (userMessage template):\n${extractUserMessageBacktick(suggestChapterSrc) || ""}`,
  ),
);

const suggestPlanTopicSrc = read("app/api/suggest-plan-topic/route.ts");
parts.push(
  block(
    "suggest-plan-topic user prompt",
    {
      File: "`app/api/suggest-plan-topic/route.ts`",
      "Call chain": "`POST /api/suggest-plan-topic` → `callXaiText`",
      Purpose: "Suggest one 5–15 word learning plan topic from completed session report",
      "User-overridable": "No",
      Variables: "`{problem}`, `{report}`",
    },
    extractVarTemplate(suggestPlanTopicSrc, "prompt") || "",
  ),
);

// prep-material — all switch cases
const prepSrc = read("app/api/prep-material/route.ts");
parts.push(
  block(
    "prep-material prompts (all types)",
    {
      File: "`app/api/prep-material/route.ts`",
      "Call chain": "`GET /api/prep-material?topic=&type=&step=`",
      Purpose: "Generate reading/exercise/resources prep markdown",
      "User-overridable": "No",
      Variables: "`{topic}`, `{type}`, `{step}`, `{contextLine}`",
    },
    prepSrc.slice(prepSrc.indexOf("switch (type)"), prepSrc.indexOf("default:") + 200),
  ),
);

// Domain 5: TAP scoring
parts.push("---\n\n## Domain 5: TAP Scoring\n\n");

parts.push(
  block(
    "`buildTapScoreInstructions`",
    {
      File: "`lib/tap-score.ts`",
      "Call chain": "TAP chat routes, `generateTapOpeningQuestion`",
      Purpose: "TAP facilitator persona and workspace context for Socratic demonstration",
      "User-overridable": "No",
      Variables: "`{assessmentTarget}`, `{minutes}`, `{brief.plan.*}`, `{nodeSummary}`, `{sessionSummary}`, `{focusSessionSummary}`, `{TAP_SCORE_MARKERS}`",
    },
    extractFunctionReturnTemplate(read("lib/tap-score.ts"), "buildTapScoreInstructions"),
  ),
);

const tapChatOverlay =
  "You are now responding in a selective thought interface, not a live voice call. The learner submits transcribed thought fragments. Reply in a Socratic style with one concise question, or at most one brief reflection followed by a question. Elicit evidence about what they learned, what they can transfer, and what gaps remain. Prioritize definitions, causal reasoning, examples, application, and repair. Do not score yet. Do not explain the answer for them unless they explicitly ask for help.";

parts.push(
  block(
    "TAP chat overlay (appended to buildTapScoreInstructions)",
    {
      File: "`workspace-tap-score/chat/route.ts`",
      "Call chain": "POST chat endpoints",
      Purpose: "Text-mode thought interface (not live voice)",
      "User-overridable": "No",
    },
    tapChatOverlay,
  ),
);

parts.push(
  block(
    "`buildTraceScoringInstructions`",
    {
      File: "`lib/tap-score-traces.ts`",
      "Call chain": "Legacy helper (no longer appended in TAP complete route)",
      Purpose: "Instruct model to use System 1 vs System 2 thought traces as proof of work",
      "User-overridable": "No",
      Variables: "`{system1Count}`, `{system2Count}`, `{manifestText}` — empty string when no traces",
    },
    extractFunctionReturnTemplate(read("lib/tap-score-traces.ts"), "buildTraceScoringInstructions") ||
      read("lib/tap-score-traces.ts").slice(
        read("lib/tap-score-traces.ts").indexOf("return `"),
        read("lib/tap-score-traces.ts").indexOf("`;", read("lib/tap-score-traces.ts").indexOf("return `")) + 1,
      ).replace(/^return `/, "").replace(/`;$/, ""),
  ),
);

parts.push(
  block(
    "TAP complete proof-of-work upload",
    {
      File: "`app/api/workspace-tap-score/complete/route.ts`",
      "Call chain": "`POST /api/workspace-tap-score/complete`",
      Purpose: "Upload tap-transcript proof of work and mark TAP session completed (no inline scoring)",
      "User-overridable": "No",
      Variables: "`{transcript}`, `{durationSeconds}`, `{tapSessionId}` — uses `buildTapTranscriptPayload` + `uploadWorkspaceProofOfWork`",
    },
    "No LLM scoring prompt. On completion, serializes transcript to tool proof of work (`tool_name: tap-transcript`), marks `workspace_tap_sessions.status = completed`, and returns the learner to the workspace. Score via POST .../verification-score (MCP verification_score).",
  ),
);

// Domain 6: Agent v2
parts.push("---\n\n## Domain 6: Agent v2 Proof-of-Work\n\n");

parts.push(
  block(
    "`buildProofOfWorkSchemaInstructions`",
    {
      File: "`lib/agent-v2/proof-of-work-schema.ts`",
      "Call chain": "`generateWorkspaceProofOfWorkSpec` → Responses API",
      Purpose: "Formal proof-of-work spec JSON (schema, upload contract, performance contract, TIM)",
      "User-overridable": "No",
      Variables: "`{request.definition}`, `{integration_hints}`, `{blockId}` scope, `{workspacePayload}` summary",
    },
    extractFunctionReturnTemplate(
      read("lib/agent-v2/proof-of-work-schema.ts"),
      "buildProofOfWorkSchemaInstructions",
    ),
  ),
);

parts.push(
  block(
    "`buildProofOfWorkSchemaPrompt`",
    {
      File: "`lib/agent-v2/proof-of-work-schema.ts`",
      "Call chain": "User message paired with instructions above",
      Purpose: "One-line generation request",
      Variables: "`{workspaceTitle}`",
    },
    extractFunctionReturnTemplate(
      read("lib/agent-v2/proof-of-work-schema.ts"),
      "buildProofOfWorkSchemaPrompt",
    ),
  ),
);

parts.push(
  block(
    "`buildIntegrationSkillInstructions`",
    {
      File: "`lib/agent-v2/integration-skill.ts`",
      "Call chain": "integration-skill routes + MCP",
      Purpose: "Generate partner skill.md with continuous evaluation + REST/MCP docs",
      "User-overridable": "No",
      Variables: "`{integration_name}`, `{workspace.*}`, `{blocks}`, API paths, optional proofOfWorkSpec section",
    },
    extractFunctionReturnTemplate(
      read("lib/agent-v2/integration-skill.ts"),
      "buildIntegrationSkillInstructions",
    ),
  ),
);

parts.push(
  block(
    "`buildIntegrationSkillPrompt`",
    {
      File: "`lib/agent-v2/integration-skill.ts`",
      Purpose: "User message for skill.md generation",
      Variables: "`{workspaceTitle}`, `{integrationName}`",
    },
    extractFunctionReturnTemplate(
      read("lib/agent-v2/integration-skill.ts"),
      "buildIntegrationSkillPrompt",
    ),
  ),
);

parts.push(
  block(
    "`buildPerformanceReportInstructions`",
    {
      File: "`lib/agent-v2/performance-report.ts`",
      "Call chain": "v2 performance report mode, workspace performance-report, MCP",
      Purpose: "Structured scorecard: overall_score, conversion_score, marker_scores, gap_analysis",
      "User-overridable": "No (optional `style_prompt`)",
      Variables: "`{blockId}` scope, `{workspaceConversionGoal}`, `{stylePrompt}`",
    },
    extractFunctionReturnTemplate(
      read("lib/agent-v2/performance-report.ts"),
      "buildPerformanceReportInstructions",
    ),
  ),
);

parts.push(
  block(
    "`PERFORMANCE_REMEDIATION_GUARDRAILS`",
    {
      File: "`lib/agent-v2/performance-report.ts`",
      Purpose: "Shared guardrails — no TAP/ILE/block remediation in outputs",
    },
    extractConstTemplate(read("lib/agent-v2/performance-report.ts"), "PERFORMANCE_REMEDIATION_GUARDRAILS"),
  ),
);

parts.push(
  block(
    "`buildPerformanceChatInstructions`",
    {
      File: "`lib/agent-v2/performance-context.ts`",
      "Call chain": "demo performance chat (Orbit); not a public Proof-of-Work API surface",
      Purpose: "Conversational performance analysis grounded in attachments",
      Variables: "`{blockId}`, `{stylePrompt}`",
    },
    extractFunctionReturnTemplate(
      read("lib/agent-v2/performance-context.ts"),
      "buildPerformanceChatInstructions",
    ),
  ),
);

// Domain 7: Labs / misc
parts.push("---\n\n## Domain 7: Labs / Local / Misc\n\n");

parts.push(
  block(
    "labs-ai `SYSTEM_PROMPT`",
    {
      File: "`lib/labs-ai.ts`",
      "Call chain": "`generateProbes(topic)` client-side",
      Purpose: "3 EEG lab Socratic probes as JSON",
    },
    extractConstTemplate(read("lib/labs-ai.ts"), "SYSTEM_PROMPT"),
  ),
);

const localInferenceSrc = read("lib/local-inference.ts");
parts.push(
  block(
    "local-inference prompts",
    {
      File: "`lib/local-inference.ts`",
      Purpose: "Browser Gemma transcription + Socratic probe",
      Variables: "LocalAnalysisContext: planGoal, currentStep, recentTranscripts, toolEvents, facialSummary, eegSummary, previousProbes, tutoringLanguage",
    },
    `TRANSCRIPTION USER (inline in messages array):
Transcribe the audio exactly as spoken. Only output the transcription, no commentary.

PROBE SYSTEM (const systemPrompt = ...):
${localInferenceSrc.match(/const systemPrompt = `([\s\S]*?)`;/)?.[1] || ""}

PROBE USER (const userPrompt = ...):
${extractVarTemplate(localInferenceSrc, "userPrompt") || ""}`,
  ),
);

parts.push(
  block(
    "suggest-grokipedia-terms user prompt",
    {
      File: "`app/api/suggest-grokipedia-terms/route.ts`",
      "Call chain": "`POST /api/suggest-grokipedia-terms`",
      Variables: "`{sessionProblem}`, `{currentPlanStep}`, `{activeProbes}`",
    },
    read("app/api/suggest-grokipedia-terms/route.ts").match(/const prompt = `([\s\S]*?)`;/)?.[1],
  ),
);

parts.push(
  block(
    "rabbit-hole/interview system prompt",
    {
      File: "`app/api/rabbit-hole/interview/route.ts`",
      "Call chain": "`POST /api/rabbit-hole/interview`",
    },
    "Generate exactly one calm, personal, 3-choice multiple-choice question based only on the user's Rabbit Hole question path. Return JSON with question, choices, correctIndex, rationale. choices must contain exactly 3 strings. correctIndex must be 0, 1, or 2.",
  ),
);

parts.push(
  block(
    "insights/create system prompt",
    {
      File: "`app/api/insights/create/route.ts`",
      "Call chain": "`POST /api/insights/create`",
    },
    'Turn learner thought traces into one insight bookmark. Return JSON: { "title": "4-12 words", "summary": "2-4 sentences, rephrased synthesis — not a quote dump." }',
  ),
);

// create-verification-workspace + demo/workspace consumer
const cvwSrc = read("lib/agent-v2/create-verification-workspace.ts");
const cvwUsers = extractUserMessageTemplates(cvwSrc);
parts.push("---\n\n## Domain 6b: Verification Workspace Generation\n\n");
parts.push(
  block(
    "`createVerificationWorkspaceFromPrompt` userMessage",
    {
      File: "`lib/agent-v2/create-verification-workspace.ts`",
      "Call chain":
        "`POST /api/demo/workspace` → `createVerificationWorkspaceFromPrompt`; also `POST /api/v3/pow/workspaces` uses a related template",
      Purpose:
        "Generate 3–6 assessable workspace blocks with conversion_goal from natural-language prompt (+ optional files)",
      "User-overridable": "No",
      Variables: "`{initialPrompt}`, `{fileContext}`, appended `WORKSPACE_GENERATION_CONVERSION_GOAL_RULE`",
    },
    cvwUsers[0] || "(not found)",
  ),
);

parts.push(
  block(
    "demo/workspace route (consumer)",
    {
      File: "`app/api/demo/workspace/route.ts`",
      "Call chain": "`POST /api/demo/workspace` → `createVerificationWorkspaceFromPrompt(demo.workspacePrompt, …)`",
      Purpose: "Demo admin: materialize verification workspace from demo definition prompt",
      "User-overridable": "No",
      "Delegates to": "`lib/agent-v2/create-verification-workspace.ts` — see verbatim userMessage above",
    },
    "This route has no inline prompt strings. Prompt text lives in createVerificationWorkspaceFromPrompt.",
  ),
);

// generateTapOpeningQuestion (split from buildTapScoreInstructions)
const ghcSrc = read("lib/tap-score.ts");
for (const extra of extractTapOpeningQuestionExtras(ghcSrc)) {
  const isSystem = extra.symbol.includes("system");
  parts.push(
    block(
      `\`${extra.symbol}\``,
      {
        File: "`lib/tap-score.ts`",
        "Call chain":
          "`generateTapOpeningQuestion` → `callXai` (TAP opening question before chat)",
        Purpose: isSystem
          ? "System extension appended after full buildTapScoreInstructions output"
          : "User message naming the demonstration target block/title",
        "User-overridable": "No",
        Variables: isSystem ? "`{context}` = full buildTapScoreInstructions output" : "`{target}` block or plan title",
      },
      extra.text,
    ),
  );
}

// Scanner inventory appendix (discover-llm-prompts.mjs)
if (fs.existsSync(SITES_PATH)) {
  const sites = JSON.parse(fs.readFileSync(SITES_PATH, "utf8"));
  parts.push("---\n\n## Scanner Inventory Appendix\n\n");
  parts.push(
    `Discovered via \`scripts/discover-llm-prompts.mjs\` at ${sites.generated_at}: **${sites.allInventoryPaths.length}** production paths.\n`,
  );
  parts.push("| Path | Category |\n|---|---|");
  const consumerSet = new Set(sites.consumers || []);
  const supplementalSet = new Set(sites.supplemental || []);
  for (const p of sites.allInventoryPaths) {
    const rel = `${p}`;
    let cat = "call-site";
    if (consumerSet.has(p)) cat = "consumer";
    else if (supplementalSet.has(p)) cat = "supplemental";
    parts.push(`| \`${rel}\` | ${FILE_MAP[rel] || cat} |`);
  }
  parts.push("");
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, parts.join("\n"));
console.log("Wrote", OUT, "size:", fs.statSync(OUT).size);