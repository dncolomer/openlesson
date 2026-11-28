/**
 * Manual Mode selected-block unsys model surface wiring.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUTHOR_UNSYS_MODEL_DRAWER_ID,
  AUTHOR_UNSYS_MODEL_DRAWER_TITLE,
  AUTHOR_UNSYS_MODEL_SURFACE,
  AUTHOR_UNSYS_STUDIO_SURFACE,
} from "@/lib/author-unsys-model";
import {
  MANUAL_MAP_MODE_LABEL,
  resolveWorkspaceHeliosColumnSurface,
} from "@/lib/workspace-helios-mode";
import { workspaceBlockDetailDrawerIds } from "@/lib/workspace-right-pane";
import { tmpdir } from "node:os";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-54e8f9ec94f9/implementer");

function read(rel: string) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("author unsys model Manual Mode wiring", () => {
  it("mounts inspect/editor/seed on Manual Mode selected blocks, not Helios or play-only", () => {
    const graph = read("components/WorkspaceUnsysSeedGraph.tsx");
    const route = read("app/api/learn/session-branch-model/route.ts");
    const update = read("lib/workspace-grid-ops/update_block.ts");

    expect(MANUAL_MAP_MODE_LABEL).toBe("Manual Mode");
    expect(AUTHOR_UNSYS_MODEL_DRAWER_TITLE).toBe("Unsys model");
    expect(AUTHOR_UNSYS_MODEL_DRAWER_ID).toBe("unsys_model");
    expect(AUTHOR_UNSYS_MODEL_SURFACE).toBe("data-author-unsys-model");
    expect(AUTHOR_UNSYS_STUDIO_SURFACE).toBe("data-author-unsys-studio");

    const inspector = read("components/WorkspaceUnsysSeedInspector.tsx");
    expect(inspector).toContain("data-author-unsys-action-price");
    expect(inspector).toContain("data-author-unsys-branch-title");
    expect(inspector).toContain("data-author-unsys-graph-add");
    expect(graph).toContain("data-author-unsys-graph");
    expect(graph).toContain('data-learning-model-canvas="2d"');
    expect(graph).toContain("data-author-unsys-graph-infinite");
    expect(graph).not.toContain("data-author-unsys-graph-add");
    expect(graph).not.toContain("data-author-unsys-action-price");
    expect(graph).toContain("seedAuthorUnsysPositions");

    const playOnly = resolveWorkspaceHeliosColumnSurface({
      authoring: false,
      playView: true,
      mode: "helios",
    });
    expect(playOnly.showHeliosChat).toBe(false);
    expect(playOnly.showModeToggle).toBe(false);
    const helios = resolveWorkspaceHeliosColumnSurface({
      authoring: true,
      mode: "helios",
    });
    expect(helios.showHeliosChat).toBe(false);
    expect(helios.showManualDrawers).toBe(true);
    const manual = resolveWorkspaceHeliosColumnSurface({
      authoring: true,
      mode: "manual",
    });
    expect(manual.showManualDrawers).toBe(true);
    expect(manual.showHeliosChat).toBe(false);

    const ids = workspaceBlockDetailDrawerIds({ canEdit: true });
    expect(ids).toContain("unsys_model");
    expect(ids).not.toContain("simulation");
    expect(ids).not.toContain("local");
    expect(ids).not.toContain("goals");
    expect(ids.indexOf("unsys_model")).toBeLessThan(ids.indexOf("edit"));
    expect(workspaceBlockDetailDrawerIds({ canEdit: false })).not.toContain(
      "unsys_model",
    );

    expect(route).toContain("studentSessionModelFromAuthorSeed");
    expect(route).toContain("answers_model_seed");
    expect(route).toContain("authorSeedBlockIdFromPreparePlan");
    expect(read("lib/session-branch-prepare.ts")).toContain("sessionPrepareBlockId");
    expect(route).toContain("generateSessionBranchOpening");
    const sessionView = read("components/session-view/use-session-field.ts");
    const canvas = read("components/session-view/session-chapter-canvas.tsx");
    const field = read("components/session-view/use-session-field.ts");
    expect(sessionView).toContain("learnSessionFieldInput");
    expect(sessionView).toContain("blockId: sessionBlockId");
    expect(canvas).toContain("sessionPrepareBlockId");
    expect(field).toContain("metadata: session.metadata");
    expect(update).toContain("answers_model_seed");
    expect(update).toContain("serializeAuthorUnsysModelSeed");

    writeEvidence(
      "author-model-manual-wiring.log",
      [
        "manualDrawers=" + manual.showManualDrawers,
        "heliosChat=" + helios.showHeliosChat,
        "playHelios=" + playOnly.showHeliosChat,
        "drawerId=" + ids.includes("unsys_model"),
        "routeSeed=" + route.includes("studentSessionModelFromAuthorSeed"),
      ].join("\n"),
    );
    expect(existsSync(join(SCRATCH, "author-model-manual-wiring.log"))).toBe(true);
  });
});
