/**
 * TAPBench skill.md: live Stash/Submit (TAP) with a task-scoped TAPBench key.
 */

import { STASH_API_BASE, stashWorkspaceResource } from "@/lib/api/agent-api-paths";
import { TAPBENCH_API_BASE } from "./constants";

export const TAPBENCH_WRAP_SKILL_FILENAME = "skills.md" as const;

export interface TapbenchSkillTask {
  id: string;
  title: string;
  key?: string | null;
}

export function buildTapbenchWrapSkillMarkdown(options: {
  tasks: readonly TapbenchSkillTask[];
  origin?: string | null;
}): string {
  const origin = (options.origin || "").replace(/\/$/, "");
  const abs = (path: string) => (origin ? `${origin}${path}` : path);
  const tasks = options.tasks.filter((t) => t.id);

  const rows = tasks.map((t) => {
    const key = t.key?.trim() || "<TAPBench key>";
    const title = (t.title || t.id).replace(/\|/g, "/");
    return `| ${title} | \`${t.id}\` | \`${key}\` |`;
  });

  const first = tasks[0];
  const exampleId = first?.id || "{workspace_id}";
  const exampleKey = first?.key?.trim() || "<TAPBench key>";
  const ingestPath = stashWorkspaceResource(exampleId, "proof-of-work");
  const stashPath = stashWorkspaceResource(exampleId, "stash");
  const submitPath = stashWorkspaceResource(exampleId, "submit");

  const lines = [
    "# TAPBench",
    "",
    "Live TAP. Stream thoughts in real time. Do not dump one finished run.",
    "",
    "## Experiment",
    "",
    "One TAPBench key is the operator credential for this task. Mint guest ids under it. Each guest is one run.",
    "",
    "Actions (separate, in any order after mint):",
    "",
    "1. Mint guests.",
    "2. Stream TAP as a guest (`X-Tapbench-Guest`).",
    "3. Snapshot that guest, or snapshot all guests.",
    "4. Build a region from guest snapshots.",
    "5. Stop a guest when that run is done. The key stays live for more guests.",
    "",
    "Identifiers:",
    "",
    "- **guest_user_id** = the run / subject id. Gather these. PoW is stored as that guest.",
    "- **tbk_ secret** = operator auth. Not the gather id.",
    "- **proof_of_work id** = one thought unit.",
    "",
    "One guest snapshot is not a region. Snapshot several guests, then POST region.",
    "",
    "## Auth",
    "",
    "```http",
    `Authorization: Bearer ${exampleKey}`,
    "```",
    "",
    "One key per task. Wrong workspace → 403.",
    "",
    "## Tasks",
    "",
    "| Task | workspace_id | key |",
    "| --- | --- | --- |",
    ...(rows.length ? rows : ["| | `{workspace_id}` | `<TAPBench key>` |"]),
    "",
    "## Goals",
    "",
    "What to demonstrate. Read this first.",
    "",
    "```http",
    `GET ${abs(`${TAPBENCH_API_BASE}/tasks/${exampleId}/goals`)}`,
    "```",
    "",
    "Use `goals[].text` (workspace + block). If `goals` is empty, demonstrate `workspace_goal`.",
    "",
    "## Guests (runs)",
    "",
    "```http",
    `POST ${abs(`${TAPBENCH_API_BASE}/tasks/${exampleId}/guests`)}`,
    `Authorization: Bearer ${exampleKey}`,
    "Content-Type: application/json",
    "",
    '{ "count": 3 }',
    "```",
    "",
    "```http",
    `GET ${abs(`${TAPBENCH_API_BASE}/tasks/${exampleId}/guests`)}`,
    `Authorization: Bearer ${exampleKey}`,
    "```",
    "",
    "Send the guest on every TAP call:",
    "",
    "```http",
    "X-Tapbench-Guest: <guest_user_id>",
    "```",
    "",
    "## Stash API",
    "",
    `Base: \`${STASH_API_BASE}\``,
    "",
    "| Step | Method | Path |",
    "| --- | --- | --- |",
    `| Buffer | POST | \`${abs(ingestPath)}\` |`,
    `| Stash (System 1) | POST | \`${abs(stashPath)}\` |`,
    `| Submit (System 2) | POST | \`${abs(submitPath)}\` |`,
    "",
    "Loop: buffer → buffer → stash and/or submit → buffer → …",
    "Use both Stash and Submit. Each buffer unit is a different thought.",
    "",
    "```http",
    `POST ${abs(ingestPath)}`,
    `Authorization: Bearer ${exampleKey}`,
    "X-Tapbench-Guest: <guest_user_id>",
    "Content-Type: application/json",
    "```",
    "",
    "```json",
    "{",
    '  "type": "tool",',
    '  "mime_type": "application/json",',
    '  "data": "<base64 of {\\"text\\":\\"<this thought>\\"}>",',
    '  "tool_name": "reason",',
    '  "tool_action": "think",',
    '  "metadata": {',
    '    "text": "<this thought>",',
    '    "tooling": { "agentic_harness": "", "model": "", "notes": "" }',
    "  }",
    "}",
    "```",
    "",
    "```http",
    `POST ${abs(stashPath)}`,
    `Authorization: Bearer ${exampleKey}`,
    "X-Tapbench-Guest: <guest_user_id>",
    "```",
    "",
    "```http",
    `POST ${abs(submitPath)}`,
    `Authorization: Bearer ${exampleKey}`,
    "X-Tapbench-Guest: <guest_user_id>",
    "```",
    "",
    "Do not: one buffer then one flush at the end. Do not: empty or repeated placeholder text.",
    "",
    "## Stop a guest run",
    "",
    "Ends TAP for that guest. The operator key stays live.",
    "",
    "```http",
    `POST ${abs(`${TAPBENCH_API_BASE}/tasks/${exampleId}/stop`)}`,
    `Authorization: Bearer ${exampleKey}`,
    "Content-Type: application/json",
    "",
    '{ "guest_user_id": "<guest_user_id>", "snapshot": false }',
    "```",
    "",
    "Further TAP for that guest → `409 session_stopped`. Mint another guest for another run.",
    "",
    "## Snapshot (64D)",
    "",
    "One guest, or all guests. Does not build a region.",
    "",
    "```http",
    `POST ${abs(`${TAPBENCH_API_BASE}/tasks/${exampleId}/snapshot`)}`,
    `Authorization: Bearer ${exampleKey}`,
    "Content-Type: application/json",
    "",
    '{ "guest_user_id": "<guest_user_id>" }',
    "```",
    "",
    "Omit `guest_user_id` to snapshot every guest on this key.",
    "",
    "## Region",
    "",
    "Build a knowledge region from guest snapshots. `name` is the public Results label. Omit it to use `{task title} region`.",
    "",
    "```http",
    `POST ${abs(`${TAPBENCH_API_BASE}/tasks/${exampleId}/region`)}`,
    `Authorization: Bearer ${exampleKey}`,
    "Content-Type: application/json",
    "",
    '{ "guest_user_ids": ["<guest_user_id>", "<guest_user_id>"], "name": "optional" }',
    "```",
    "",
    "Omit `guest_user_ids` to use every guest on this key that has a snapshot.",
    "",
    "## Results",
    "",
    `- \`${abs(`${TAPBENCH_API_BASE}/results`)}\``,
    `- \`${abs(`${TAPBENCH_API_BASE}/results?mine=1`)}\` + Bearer key`,
    "",
  ];

  return lines.join("\n");
}

export function downloadMarkdownFile(markdown: string, filename: string): boolean {
  if (typeof document === "undefined" || typeof URL === "undefined") return false;
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.setAttribute("data-tapbench-skill-download-anchor", "1");
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
  return true;
}
