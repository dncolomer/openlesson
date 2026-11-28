import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const BASELINE_SQL = path.join(ROOT, "supabase/migrations/20261128120000_baseline.sql");

function parseBaselineTableColumns(sql: string): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const tableRe = /CREATE TABLE public\.([a-z0-9_]+)\s*\(([\s\S]*?)\);/g;
  let match: RegExpExecArray | null;
  while ((match = tableRe.exec(sql)) !== null) {
    const tableName = match[1]!;
    const body = match[2]!;
    const cols = new Set<string>();
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (
        !line ||
        line.startsWith("CONSTRAINT ") ||
        line.startsWith("PRIMARY KEY") ||
        line.startsWith("UNIQUE ") ||
        line.startsWith("CHECK ") ||
        line.startsWith("FOREIGN KEY")
      ) {
        continue;
      }
      const colMatch = /^"?([a-z0-9_]+)"?\s+/.exec(line);
      if (colMatch) cols.add(colMatch[1]!);
    }
    tables.set(tableName, cols);
  }
  return tables;
}

const ACTIVE_CORE_FILES = [
  "lib/pow-api/workspace-proof-of-work.ts",
  "lib/pow-api/upload-workspace-proof-of-work.ts",
  "lib/pow-api/anonymous-tap-guest.ts",
  "lib/pow-api/resolve-workspace-guest.ts",
  "lib/guest-link-query-guest.ts",
  "lib/guest-session-tables.ts",
  "lib/tap-score-session-auth.ts",
  "lib/tap-score-traces.ts",
  "lib/unified-sessions.ts",
  "lib/flow-embedding-store.ts",
  "lib/verification-flow-repository.ts",
  "lib/region-simulation-persist.ts",
  "lib/region-simulation-jobs.ts",
  "app/api/verify/session/canvas/route.ts",
  "app/api/verify/session/speech/route.ts",
  "app/api/verify/session/idle/route.ts",
  "app/api/verify/session/trace/route.ts",
  "app/api/verify/session/branch-model/route.ts",
  "app/api/verify/session/policy-infer/route.ts",
  "app/api/session/embed/route.ts",
  "app/api/verification-flow/public/[token]/route.ts",
  "app/api/verification-flow/public/[token]/results/route.ts",
];

const DROPPED_COLUMNS = [
  "workspace_id",
  "block_id",
  "chapter_map",
  "probes",
  "planning_prompt",
] as const;

describe("schema-column alignment guardrail", () => {
  const baselineSql = fs.readFileSync(BASELINE_SQL, "utf8");
  const tableColumns = parseBaselineTableColumns(baselineSql);

  it("baseline omits dropped columns from proof_of_work, sessions, session_embeddings, and organization_guest_users", () => {
    for (const table of [
      "proof_of_work",
      "sessions",
      "session_embeddings",
      "organization_guest_users",
    ]) {
      const cols = tableColumns.get(table);
      expect(cols, `table ${table} missing from baseline`).toBeDefined();
      for (const dropped of DROPPED_COLUMNS) {
        expect(cols!.has(dropped), `${table} unexpectedly contains ${dropped}`).toBe(false);
      }
    }
  });

  it("active verification/PoW/session/embedding modules never filter or select dropped DB columns", () => {
    const violations: string[] = [];
    const filterRe =
      /\.(?:eq|neq|in)\(\s*["'](workspace_id|block_id|chapter_map|probes|planning_prompt)["']/g;
    const selectConstRe =
      /(?:SELECT|select)\s*(?:=|\()\s*["']([^"']*(?:workspace_id|block_id|chapter_map|probes|planning_prompt)[^"']*)["']/g;

    for (const rel of ACTIVE_CORE_FILES) {
      const fullPath = path.join(ROOT, rel);
      const source = fs.readFileSync(fullPath, "utf8");
      for (const m of source.matchAll(filterRe)) {
        violations.push(`${rel}: filter on dropped column "${m[1]}"`);
      }
      for (const m of source.matchAll(selectConstRe)) {
        violations.push(`${rel}: select includes dropped column in "${m[1]}"`);
      }
    }

    expect(violations).toEqual([]);
  });
});
