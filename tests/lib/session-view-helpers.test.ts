import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  SESSION_LOG_MAX_ENTRIES,
  capSessionLogs,
  createEmptyTransferHealth,
  isDuplicateProbe,
  readErrorResponse,
} from "@/components/session/sessionViewHelpers";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("sessionViewHelpers", () => {
  it("isDuplicateProbe detects normalized duplicates", () => {
    const existing = [{ text: "Why is the sky blue?" }, { text: "Unrelated" }];
    expect(isDuplicateProbe("Why is the sky blue?", existing)).toBe(true);
    expect(isDuplicateProbe("Completely different question here!", existing)).toBe(false);
  });

  it("createEmptyTransferHealth initializes counters", () => {
    const health = createEmptyTransferHealth();
    expect(health.audio).toEqual({ sent: 0, saved: 0, failed: 0 });
    expect(health.tools.failed).toBe(0);
  });

  it("readErrorResponse prefers JSON error messages", async () => {
    const response = new Response(JSON.stringify({ error: "Nope" }), { status: 422 });
    const message = await readErrorResponse(response, "fallback");
    expect(message).toContain("Nope");
    expect(message).toContain("422");
  });

  it("capSessionLogs keeps only the newest 500 entries", () => {
    expect(SESSION_LOG_MAX_ENTRIES).toBe(500);
    expect(capSessionLogs([1, 2, 3])).toEqual([1, 2, 3]);
    const overflow = Array.from({ length: 650 }, (_, i) => i);
    const kept = capSessionLogs(overflow);
    expect(kept).toHaveLength(500);
    expect(kept[0]).toBe(150);
    expect(kept[499]).toBe(649);
    expect(overflow).toHaveLength(650);
  });

  it("logs pane scrolls and every append path uses the 500-entry cap", () => {
    const panes = read("components/session-view/session-tool-panes.tsx");
    const runtime = read("components/session-view/use-session-runtime.ts");
    const tool = read("components/LogsTool.tsx");

    expect(panes).toContain("data-ile-logs-pane");
    expect(panes).toContain("flex h-0 min-h-0 flex-1 flex-col overflow-hidden");
    expect(runtime).toContain("capSessionLogs");
    expect(runtime).not.toContain("slice(-400)");
    expect(tool).toContain("data-ile-logs-scroll");
    expect(tool).toContain("overflow-y-auto");
    expect(tool).toContain("SESSION_LOG_MAX_ENTRIES");
    expect(tool).toContain("capSessionLogs");
    expect(tool).not.toContain("slice(-200)");
  });
});
