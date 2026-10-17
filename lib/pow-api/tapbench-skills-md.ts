/**
 * TAPBench → agent-facing skills.md builder.
 *
 * TAPBench is the headless proof-of-work API with flow_kind=tapbench.
 * Filename is always `skills.md`.
 */

import { POW_API_BASE, powWorkspaceResource } from "@/lib/api/agent-api-paths";
import { TAPBENCH_PRODUCT, TAPBENCH_POW_SOURCE } from "./tapbench";

export const TAPBENCH_SKILLS_MD_FILENAME = "skills.md" as const;

/** Optional session token header (Bearer on /api/v3/pow is the public path). */
export const TAPBENCH_SESSION_HEADER = "X-Tapbench-Session" as const;

export interface TapbenchSkillsMdInput {
  workspace_id: string;
  block_id?: string | null;
  id?: string | null;
  session_token: string;
  url: string;
  exercise?: string | null;
  duration_seconds?: number | null;
  expires_at?: string | null;
  remaining_ms?: number | null;
  status?: string | null;
  baseUrl?: string | null;
}

export function buildTapbenchSkillsMarkdown(input: TapbenchSkillsMdInput): string {
  const workspaceId = (input.workspace_id || "").trim();
  const sessionToken = (input.session_token || "").trim();
  const url = (input.url || "").trim();
  const blockId =
    typeof input.block_id === "string" && input.block_id.trim()
      ? input.block_id.trim()
      : null;
  const linkId =
    typeof input.id === "string" && input.id.trim() ? input.id.trim() : null;
  const exercise =
    typeof input.exercise === "string" && input.exercise.trim()
      ? input.exercise.trim()
      : null;
  const base = (input.baseUrl || "").replace(/\/$/, "");
  const abs = (path: string) => (base ? `${base}${path}` : path);

  const sessionsPath = powWorkspaceResource(workspaceId, "sessions");
  const resolveApiPath = `/api/tapbench/${sessionToken || "{session_token}"}`;

  const remaining =
    typeof input.remaining_ms === "number" && Number.isFinite(input.remaining_ms)
      ? Math.max(0, Math.round(input.remaining_ms / 1000))
      : null;
  const duration =
    typeof input.duration_seconds === "number" && Number.isFinite(input.duration_seconds)
      ? Math.round(input.duration_seconds)
      : null;

  const lines: string[] = [
    `# ${TAPBENCH_PRODUCT.name} agent skill`,
    ``,
    `Use this skill when solving a **TAPBench** timed exercise via the **headless proof-of-work API** (the same API humans and agents use for Calibrate, Learn, and Verify). ChatGPT, Claude, or another agent authorizes against Uncertain Systems and runs the flow.`,
    ``,
    `There are two public APIs: workspace management (\`/api/v3/workspaces\`) and headless proof-of-work (\`${POW_API_BASE}\`). TAPBench is **not** a third API. Snapshot and Stash are not public agent APIs.`,
    ``,
    `## Session credentials`,
    ``,
    `| Field | Value |`,
    `| --- | --- |`,
    `| Workspace ID | \`${workspaceId || "(missing)"}\` |`,
    ...(blockId ? [`| Block ID | \`${blockId}\` |`] : []),
    ...(linkId ? [`| TAPBench link ID | \`${linkId}\` |`] : []),
    `| Session token | \`${sessionToken || "(missing)"}\` |`,
    `| Share / resolve URL | ${url || "(missing)"} |`,
    ...(duration != null ? [`| Duration | ${duration}s |`] : []),
    ...(input.expires_at ? [`| Expires at | \`${input.expires_at}\` |`] : []),
    ...(remaining != null ? [`| Remaining (approx) | ${remaining}s |`] : []),
    ...(input.status ? [`| Status | \`${input.status}\` |`] : []),
    ``,
    `### Auth`,
    ``,
    `Authorization: Bearer <api_key> on every call. You may also send:`,
    ``,
    "```http",
    `${TAPBENCH_SESSION_HEADER}: ${sessionToken || "<session_token>"}`,
    "Content-Type: application/json",
    "```",
    ``,
    `When the clock expires, the API returns **401** with \`session_expired\` on \`error.code\` plus \`error.details.expires_at\`, \`error.details.remaining_ms\`, and \`error.details.tapbench\` — **stop sending** proof of work.`,
    ``,
    `## Exercise`,
    ``,
  ];

  if (exercise) {
    lines.push(exercise, ``);
  } else {
    lines.push(
      `Open the resolve URL (or call the resolve API) to obtain the exercise text:`,
      ``,
      `- Browser / share: ${url || abs(`/tapbench/${sessionToken || "{token}"}`)}`,
      `- Machine: \`GET ${abs(resolveApiPath)}\` → JSON with \`exercise\`, \`remaining_ms\`, \`session_token\`.`,
      ``,
    );
  }

  const startPath = abs(sessionsPath);
  const powHint = `${startPath}/{session_id}/proof-of-work`;
  const endHint = `${startPath}/{session_id}/end`;

  lines.push(
    `## Headless proof-of-work workflow`,
    ``,
    `Base path: \`${POW_API_BASE}\`. MCP twin: \`start_session\` (flow_kind=tapbench), \`upload_proof_of_work\`, \`end_session\`.`,
    ``,
    `### Required agent protocol (continuous thoughts)`,
    ``,
    `Solve the exercise like a live TAP session: **stream many different thoughts** into the session — do **not** send one smoke unit or only one end-of-session batch.`,
    ``,
    `1. **Start** — POST \`${startPath}\` with \`flow_kind: "tapbench"\`, catalog_size 4, 8, or 16, and duration. The server prepares the answers-model tree and starts the clock.`,
    `2. **Buffer continuously** — POST many **distinct** thought units to the session proof-of-work path while you work (partial reasoning, checks, dead ends, revisions). Each unit must carry real free text in \`text\` / \`reasoning\` / \`content\` (and mirror it in \`metadata.text\` / \`metadata.prompt\`).`,
    `3. **The server infers the path** on the prepared tree from that proof plus actions, the same way the live flow does.`,
    `4. **Interleave** — typical loop: start_session → upload thought A → upload thought B → … until time expires → end_session.`,
    `5. Stop when \`remaining_ms\` is 0 or requests return \`session_expired\`.`,
    ``,
    `**Anti-patterns (do not do these):**`,
    ``,
    `- A single upload with \`tool_name\` like \`tapbench_smoke\` / empty or placeholder text`,
    `- One buffer + one flush at the end only, with no intermediate thoughts`,
    `- Buffering without ever putting the actual words of your reasoning in \`text\`/\`reasoning\`/\`content\``,
    `- Calling Snapshot, Stash, or a separate TAPBench REST family`,
    ``,
    `| Step | Method | Path | When |`,
    `| --- | --- | --- | --- |`,
    `| Start session | \`POST\` | \`${startPath}\` | Begin TAPBench / Calibrate / Learn / Verify |`,
    `| Upload PoW | \`POST\` | \`${powHint}\` | Every new distinct thought while solving |`,
    `| End session | \`POST\` | \`${endHint}\` | Clock expired or you are done |`,
    ``,
    `### Example: start then stream a thought`,
    ``,
    "```http",
    `POST ${startPath}`,
    "Authorization: Bearer <api_key>",
    "Content-Type: application/json",
    "```",
    ``,
    "```json",
    `{`,
    `  "flow_kind": "tapbench",`,
    `  "catalog_size": 4,`,
    `  "duration_minutes": 15${blockId ? `,` : ``}`,
    ...(blockId ? [`  "block_id": "${blockId}"`] : []),
    `}`,
    "```",
    ``,
    "```http",
    `POST ${powHint}`,
    "Authorization: Bearer <api_key>",
    `${TAPBENCH_SESSION_HEADER}: ${sessionToken || "<session_token>"}`,
    "Content-Type: application/json",
    "```",
    ``,
    "```json",
    `{`,
    `  "events": [`,
    `    {`,
    `      "type": "tool",`,
    `      "tool_name": "reason",`,
    `      "tool_action": "think",`,
    `      "metadata": { "prompt": "Working: N looks normal because conjugation scales the off-diagonal…", "text": "Working: N looks normal because conjugation scales the off-diagonal…" }`,
    `    }`,
    `  ]`,
    `}`,
    "```",
    ``,
    `Put the actual answer / reasoning in JSON fields such as \`text\`, \`reasoning\`, or \`content\`. Each uploaded unit should be a **different** thought, not a copy-paste of the same string.`,
    ``,
    `## Tapbench proof of work (comparable to human TAP)`,
    ``,
    `PoW on this path is:`,
    ``,
    `- Flagged \`tapbench: true\` / \`pow_source: "${TAPBENCH_POW_SOURCE}"\` (filterable vs human)`,
    `- Projected onto the prepared answers-model tree (catalog 4 / 8 / 16)`,
    `- Clock-constrained: expired sessions reject further work`,
    ...(linkId
      ? [`- \`source_link_id\` / \`tapbench_link_id\`: \`${linkId}\``]
      : []),
    ``,
    `## When to stop`,
    ``,
    `- \`remaining_ms\` reaches 0, or`,
    `- Any proof-of-work route returns **401** \`session_expired\` / \`session_ended\`, or`,
    `- Resolve URL reports an expired session.`,
    ``,
    `Do not continue uploading after the session is invalid.`,
    ``,
    `## Product`,
    ``,
    `${TAPBENCH_PRODUCT.name}: ${TAPBENCH_PRODUCT.tagline}.`,
    `${TAPBENCH_PRODUCT.description}`,
    ``,
  );

  return lines.join("\n");
}

export function tapbenchSkillsMdFilename(_input?: TapbenchSkillsMdInput): string {
  return TAPBENCH_SKILLS_MD_FILENAME;
}
