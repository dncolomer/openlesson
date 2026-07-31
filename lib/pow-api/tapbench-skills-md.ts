/**
 * TAPBench → agent-facing skills.md builder.
 *
 * Pure helper: link fields → markdown string agents can load as a skill.
 * Filename is always `skills.md` (objective spelling; product standard for this download).
 */

import { STASH_API_BASE, stashWorkspaceResource } from "@/lib/api/agent-api-paths";
import { TAPBENCH_PRODUCT, TAPBENCH_POW_SOURCE } from "./tapbench";

/** Download filename for the agent skill file. */
export const TAPBENCH_SKILLS_MD_FILENAME = "skills.md" as const;

/** Session auth header agents must send on Stash/Submit while the token is valid. */
export const TAPBENCH_SESSION_HEADER = "X-Tapbench-Session" as const;

export interface TapbenchSkillsMdInput {
  /** Workspace UUID the agent must target. */
  workspace_id: string;
  /** Optional block scope for the exercise. */
  block_id?: string | null;
  /** TAPBench link id (for PoW source_link attribution). */
  id?: string | null;
  /** Bearer session token (same as public_token on list rows). */
  session_token: string;
  /** Listable share / resolve URL (`/tapbench/{token}`). */
  url: string;
  /** Exercise text when already resolved/minted. */
  exercise?: string | null;
  duration_seconds?: number | null;
  expires_at?: string | null;
  remaining_ms?: number | null;
  status?: string | null;
  /** API origin (no trailing slash). Defaults to relative paths when empty. */
  baseUrl?: string | null;
}

/**
 * Build agent-facing skills.md content for one TAPBench link.
 * Includes concrete token, workspace id, URLs, exercise/time, and Stash/Submit paths.
 */
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

  const ingestPath = stashWorkspaceResource(workspaceId, "proof-of-work");
  const stashPath = stashWorkspaceResource(workspaceId, "stash");
  const submitPath = stashWorkspaceResource(workspaceId, "submit");
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
    `Use this skill when solving a **TAPBench** timed exercise via the **Stash/Submit API** (TAP for agents).`,
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
    ...(input.expires_at
      ? [`| Expires at | \`${input.expires_at}\` |`]
      : []),
    ...(remaining != null ? [`| Remaining (approx) | ${remaining}s |`] : []),
    ...(input.status ? [`| Status | \`${input.status}\` |`] : []),
    ``,
    `### Auth on every Stash request`,
    ``,
    `Send the session token on each call until it is invalid (time expired):`,
    ``,
    "```http",
    `${TAPBENCH_SESSION_HEADER}: ${sessionToken || "<session_token>"}`,
    "Content-Type: application/json",
    "```",
    ``,
    `You may also pass \`"session_token": "${sessionToken || "<session_token>"}"\` in the JSON body.`,
    `When the token expires, the API returns **401** with \`session_expired\` — **stop sending** proof of work.`,
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

  lines.push(
    `## Stash / Submit API workflow`,
    ``,
    `Base path: \`${STASH_API_BASE}\` (workspace-scoped).`,
    ``,
    `### Required agent protocol (continuous thoughts)`,
    ``,
    `Solve the exercise like a human TAP session: **stream many different thoughts**, then **flush when needed** — do **not** send one smoke unit or only one end-of-session batch.`,
    ``,
    `1. **Buffer continuously** — POST many **distinct** thought units while you work (partial reasoning, checks, dead ends, revisions). Each unit must carry real free text in \`text\` / \`reasoning\` / \`content\` (and mirror it in \`metadata.text\`).`,
    `2. **Stash (System 1)** — when you park intermediate / spontaneous / not-yet-final work, flush the buffer with **Stash**. Then keep thinking: buffer more units.`,
    `3. **Submit (System 2)** — when you commit a deliberate solution step or final answer, flush with **Submit**. You may Submit more than once as your solution improves.`,
    `4. **Interleave** — typical loop: buffer → buffer → … → stash and/or submit → buffer → … until time expires. Use **both** System 1 and System 2 across the session when you have both intermediate thoughts and deliberate commits.`,
    `5. On flush, the server **aligns** units with human TAP thought traces:`,
    `   - \`tool_name\`: \`stash_submit_api\``,
    `   - \`tool_action\`: \`system1:pause_finalize\` (stash) or \`system2:send\` (submit)`,
    `   - \`metadata.text\`: extracted thought text (used in knowledge embeddings)`,
    `   - \`guest_user_id\`: anonymous guest for this TAPBench link (comparable subject to human TAP guests)`,
    `6. Stop when \`remaining_ms\` is 0 or requests return \`session_expired\`.`,
    ``,
    `**Anti-patterns (do not do these):**`,
    ``,
    `- A single buffer with \`tool_name\` like \`tapbench_smoke\` / empty or placeholder text`,
    `- One buffer + one flush at the end only, with no intermediate thoughts`,
    `- Buffering without ever putting the actual words of your reasoning in \`text\`/\`reasoning\`/\`content\``,
    `- Using only Stash or only Submit for the entire session when you had both intermediate and final work`,
    ``,
    `| Step | Method | Path | When |`,
    `| --- | --- | --- | --- |`,
    `| Buffer PoW | \`POST\` | \`${ingestPath}\` | Every new distinct thought while solving |`,
    `| Stash (System 1) | \`POST\` | \`${stashPath}\` | Park intermediate / spontaneous work; clear buffer |`,
    `| Submit (System 2) | \`POST\` | \`${submitPath}\` | Commit deliberate solution / final answer; clear buffer |`,
    ``,
    `Absolute URLs (if origin known):`,
    ``,
    `- \`${abs(ingestPath)}\``,
    `- \`${abs(stashPath)}\``,
    `- \`${abs(submitPath)}\``,
    ``,
    `### Example: buffer a continuous intermediate thought`,
    ``,
    "```http",
    `POST ${abs(ingestPath)}`,
    `${TAPBENCH_SESSION_HEADER}: ${sessionToken || "<session_token>"}`,
    "Content-Type: application/json",
    "```",
    ``,
    "```json",
    `{`,
    `  "type": "tool",`,
    `  "mime_type": "application/json",`,
    `  "data": "<base64 of {\\"text\\":\\"Working: N looks normal because conjugation scales the off-diagonal…\\",\\"reasoning\\":\\"…\\"} >",`,
    `  "tool_name": "reason",`,
    `  "tool_action": "think",`,
    `  "metadata": { "text": "Working: N looks normal because conjugation scales the off-diagonal…" },`,
    `  "session_token": "${sessionToken || "<session_token>"}"${blockId ? `,` : ``}`,
    ...(blockId
      ? [`  "block_id": "${blockId}"`]
      : []),
    `}`,
    "```",
    ``,
    `Put the actual answer / reasoning in JSON fields such as \`text\`, \`reasoning\`, or \`content\` — these become \`metadata.text\` on flush (human TAP parity for region embeddings). Each buffered unit should be a **different** thought, not a copy-paste of the same string.`,
    ``,
    `### Example: when to Stash (System 1) vs Submit (System 2)`,
    ``,
    `**Stash** — intermediate thoughts you want parked (System 1):`,
    ``,
    "```http",
    `POST ${abs(stashPath)}`,
    `${TAPBENCH_SESSION_HEADER}: ${sessionToken || "<session_token>"}`,
    "Content-Type: application/json",
    "",
    `{}`,
    "```",
    ``,
    `Response includes \`decision: "stash"\`, \`system: 1\`, \`system_label: "System 1"\`, and \`flushed\` count.`,
    ``,
    `**Submit** — deliberate solution / final answer (System 2):`,
    ``,
    "```http",
    `POST ${abs(submitPath)}`,
    `${TAPBENCH_SESSION_HEADER}: ${sessionToken || "<session_token>"}`,
    "Content-Type: application/json",
    "",
    `{}`,
    "```",
    ``,
    `Response includes \`decision: "submit"\`, \`system: 2\`, \`system_label: "System 2"\`, and \`flushed\` count.`,
    ``,
    `### Example continuous session (recommended)`,
    ``,
    "```",
    "buffer thought A",
    "buffer thought B",
    "POST .../stash          → System 1 flush of A+B",
    "buffer thought C",
    "buffer final solution",
    "POST .../submit         → System 2 flush of C+final",
    "buffer correction…",
    "POST .../submit         → optional further System 2 commits",
    "```",
    ``,
    `Successful stash/submit responses include the **exercise** and **remaining_ms** while the session is valid.`,
    ``,
    `## Tapbench proof of work (comparable to human TAP)`,
    ``,
    `PoW flushed on this path is:`,
    ``,
    `- Flagged \`tapbench: true\` / \`pow_source: "${TAPBENCH_POW_SOURCE}"\` (filterable vs human)`,
    `- Shaped like TAP thought traces (\`tool_name: stash_submit_api\`, \`type: uncertain_systems_tap_thought_trace\`, \`metadata.text\`, sys1/sys2)`,
    `- Attributed to the **anonymous guest** provisioned for this link (not the workspace owner)`,
    ...(linkId
      ? [`- \`source_link_id\` / \`tapbench_link_id\` / \`tap_session_id\`: \`${linkId}\``]
      : [`- \`source_link_id\` / \`tapbench_link_id\` / \`tap_session_id\`: this link’s id`]),
    ``,
    `## When to stop`,
    ``,
    `- \`remaining_ms\` reaches 0, or`,
    `- Any stash route returns **401** \`session_expired\` / \`session_revoked\`, or`,
    `- Resolve URL reports an expired session.`,
    ``,
    `Do not continue buffering after the token is invalid.`,
    ``,
    `## Product`,
    ``,
    `${TAPBENCH_PRODUCT.name}: ${TAPBENCH_PRODUCT.tagline}.`,
    `${TAPBENCH_PRODUCT.description}`,
    ``,
  );

  return lines.join("\n");
}

/**
 * Suggested download filename for a link (always skills.md; optional link id prefix for multi-download clarity is not used —
 * product wants a stable `skills.md` name agents recognize).
 */
export function tapbenchSkillsMdFilename(_input?: Pick<TapbenchSkillsMdInput, "id">): string {
  return TAPBENCH_SKILLS_MD_FILENAME;
}

/**
 * Browser download helper: create a Blob URL and click an anchor.
 * Returns false when document/URL APIs are unavailable (SSR).
 */
export function downloadTapbenchSkillsMarkdown(
  input: TapbenchSkillsMdInput,
  options?: { filename?: string },
): boolean {
  if (typeof document === "undefined" || typeof URL === "undefined") return false;
  const markdown = buildTapbenchSkillsMarkdown(input);
  const filename = options?.filename || tapbenchSkillsMdFilename(input);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.setAttribute("data-tapbench-skills-download-anchor", "1");
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
  return true;
}
