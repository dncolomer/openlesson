/**
 * Gating tests for the Calibrate/Learn/Verify leftover cleanup.
 * Drives the shipped guest session page and real repo paths.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveTapShellFromSession } from "@/lib/exercise-tap";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

const DELETED_PATHS = [
  "components/ExerciseTapClient.tsx",
  "components/exercise-tap/ExerciseTapShell.tsx",
  "components/session-view/session-mark-controls.tsx",
  "components/session-view/session-policy-panel.tsx",
  "components/session-view/session-assert-graph.tsx",
  "components/session-view/ile-chapter-tool-tabs.tsx",
  "app/api/generate-probe/route.ts",
  "lib/session-analysis.ts",
  "lib/retry.ts",
  "lib/pow-api/mcp-tools/snapshot-handlers.ts",
  "lib/pow-api/workspace-create-ui-only.ts",
  "app/api/v3/pow/workspaces/[id]/tap-links/route.ts",
  "app/api/v3/pow/workspaces/[id]/blocks/[blockId]/tap-links/route.ts",
  "app/api/v3/pow/workspaces/[id]/proof-of-work/route.ts",
  "app/api/v3/pow/workspaces/[id]/blocks/route.ts",
  "app/api/v3/pow/workspaces/[id]/route.ts",
  "app/api/v3/pow/workspaces/route.ts",
  "components/knowledge-panel/lwm-view.tsx",
  "components/knowledge-panel/ranking-view.tsx",
  "components/knowledge-panel/strengths-gaps-view.tsx",
  "lib/ile-path-overlay.ts",
  "lib/ile-altitude-map.ts",
  "app/ile/session/[token]/page.tsx",
  "app/api/workspace/suggest-chapter-edit/route.ts",
  "components/HeliosChat.tsx",
  "components/WorkspacePromptImpactPanel.tsx",
] as const;

describe("guest TAP mounts Calibrate and Verify", () => {
  it("scout stays Calibrate and other kinds run Verify on the advertised guest page", () => {
    expect(resolveTapShellFromSession({ interaction_kind: "scout" })).toBe("scout");
    expect(resolveTapShellFromSession({ interaction_kind: "conversational" })).toBe(
      "conversational",
    );
    expect(resolveTapShellFromSession({ interaction_kind: "exercise" })).toBe("exercise");

    const guest = read("components/guest-session/private-tap-session-page.tsx");
    expect(guest).toContain("<ScoutTapClient");
    expect(guest).toContain('shell === "scout"');
    expect(guest).toContain("<TapScoreClient");
    expect(guest).toContain('sidebarMode="verification-tap"');
    expect(guest).not.toMatch(/redirect\(`\/workspace\/\$\{String\(session\.workspace_id\)\}`\)/);
    expect(guest).not.toContain("ExerciseTapClient");

    const verifyRoute = read("app/verify/session/[token]/page.tsx");
    expect(verifyRoute).toContain("private-tap-session-page");
    const calibrateRoute = read("app/calibrate/session/[token]/page.tsx");
    expect(calibrateRoute).toContain("private-tap-session-page");
  });
});

describe("upgrade leftovers are gone", () => {
  it("deleted stacks no longer exist on disk", () => {
    for (const rel of DELETED_PATHS) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(false);
    }
  });

  it("Knowledge panel no longer lists unmounted subview ids", () => {
    const perf = read("components/WorkspacePerformancePanel.tsx");
    expect(perf).not.toMatch(/"lwm"/);
    expect(perf).not.toMatch(/"ranking"/);
    expect(perf).not.toMatch(/"strengths_gaps"/);
    expect(perf).toContain('"knowledge"');
  });

  it("cookie-auth mint and headless session ingest remain", () => {
    expect(existsSync(join(ROOT, "app/api/workspace/tap-links/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/workspace/ile-links/route.ts"))).toBe(true);
    expect(
      existsSync(
        join(ROOT, "app/api/v3/pow/workspaces/[id]/sessions/[sessionId]/proof-of-work/route.ts"),
      ),
    ).toBe(true);
  });
});
