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

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-54e8f9ec94f9/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("author unsys model Manual Mode wiring", () => {
  it("mounts inspect/editor/seed on Manual Mode selected blocks, not Helios or play-only", () => {
    const drawers = read("components/workspace-view/workspace-right-drawers.tsx");
    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    const panel = read("components/WorkspaceBlockUnsysModelPanel.tsx");
    const chat = read("components/WorkspaceHeliosChat.tsx");
    const learner = read("components/WorkspaceLearnerBlockPane.tsx");
    const view = read("components/WorkspaceView.tsx");
    const studio = read("components/WorkspaceUnsysSeedStudio.tsx");
    const graph = read("components/WorkspaceUnsysSeedGraph.tsx");
    const route = read("app/api/ile/session-branch-model/route.ts");
    const update = read("lib/workspace-grid-ops/update_block.ts");

    expect(MANUAL_MAP_MODE_LABEL).toBe("Manual Mode");
    expect(AUTHOR_UNSYS_MODEL_DRAWER_TITLE).toBe("Unsys model");
    expect(AUTHOR_UNSYS_MODEL_DRAWER_ID).toBe("unsys_model");
    expect(AUTHOR_UNSYS_MODEL_SURFACE).toBe("data-author-unsys-model");
    expect(AUTHOR_UNSYS_STUDIO_SURFACE).toBe("data-author-unsys-studio");

    expect(drawers).toContain("Manual Mode");
    expect(drawers).toContain("heliosSurface.showManualDrawers");
    expect(drawers).toContain("WorkspaceBlockDetailPane");
    expect(drawers).toContain("onSaveAnswersModelSeed");
    expect(drawers).toContain("answersModelSeed={detailBlock.answers_model_seed}");
    expect(drawers).toMatch(
      /showManualDrawers &&[\s\S]*data-workspace-block-drawers/,
    );
    expect(drawers).toMatch(
      /showCreatorDrawers &&[\s\S]*<WorkspaceBlockDetailPane/,
    );

    expect(detail).toContain("WorkspaceBlockUnsysModelPanel");
    expect(detail).toContain("AUTHOR_UNSYS_MODEL_DRAWER_ID");
    expect(detail).toContain("data-author-unsys-model-drawer");
    expect(detail).toContain("onOpenUnsysStudio");
    expect(detail).toContain("{canEdit ? (");
    expect(panel).toContain("data-author-unsys-model");
    expect(panel).toContain("data-author-unsys-open");
    expect(panel).toContain("Open unsys model");
    expect(panel).not.toContain("data-author-unsys-save-seed");
    expect(panel).not.toContain("data-author-unsys-catalogs");
    expect(panel).not.toContain("data-author-unsys-action-price");
    expect(panel).not.toContain("WorkspaceBlockUnsysHeliosChat");
    expect(panel).not.toContain("Run Calibrate");
    expect(panel).not.toContain("data-author-unsys-calibrate");
    expect(panel).not.toContain("prior");

    expect(studio).toContain("data-author-unsys-studio");
    expect(studio).toContain("data-author-unsys-back");
    expect(studio).not.toContain("data-author-unsys-catalogs");
    expect(studio).not.toContain("data-author-unsys-catalog-size");
    expect(studio).toContain("data-author-unsys-generate");
    expect(studio).toContain("data-author-unsys-generating");
    expect(studio).toContain("backdrop-blur-[1px]");
    expect(studio).not.toContain("backdrop-blur-sm");
    expect(studio).not.toContain("blur-sm");
    expect(studio).not.toContain("bg-black/45");
    expect(studio).toContain('normalizeWorkspaceHeliosColumnMode("manual")');
    expect(studio).not.toContain("Generating with xAI");
    expect(studio).toContain("data-author-unsys-regenerate");
    expect(studio).toContain("data-author-unsys-save-seed");
    expect(studio).toContain("data-author-unsys-delete-seed");
    expect(studio).toContain("WorkspaceUnsysSeedGraph");
    expect(studio).toContain("WorkspaceUnsysSeedInspector");
    expect(studio).toContain("WorkspaceBlockUnsysHeliosChat");
    expect(studio).toContain("AUTHOR_UNSYS_GENERATE_PATH");
    expect(studio).toContain("data-workspace-helios-mode-toggle");
    expect(studio).not.toContain("generateAuthorUnsysSample");
    const inspector = read("components/WorkspaceUnsysSeedInspector.tsx");
    expect(inspector).toContain("data-author-unsys-action-price");
    expect(inspector).toContain("data-author-unsys-branch-title");
    expect(inspector).toContain("data-author-unsys-graph-add");
    expect(studio).not.toContain("Run Calibrate");
    expect(studio).not.toMatch(/\bprior\b/i);
    expect(graph).toContain("data-author-unsys-graph");
    expect(graph).toContain('data-learning-model-canvas="2d"');
    expect(graph).toContain("data-author-unsys-graph-infinite");
    expect(graph).not.toContain("data-author-unsys-graph-add");
    expect(graph).not.toContain("data-author-unsys-action-price");
    expect(graph).toContain("seedAuthorUnsysPositions");

    expect(chat).not.toContain("data-author-unsys-model");
    expect(chat).not.toContain("WorkspaceBlockUnsysModelPanel");
    expect(learner).not.toContain("data-author-unsys-model");
    expect(learner).not.toContain("WorkspaceBlockUnsysModelPanel");
    expect(learner).not.toContain("onSaveAnswersModelSeed");

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
    expect(helios.showHeliosChat).toBe(true);
    expect(helios.showManualDrawers).toBe(false);
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
    expect(ids.indexOf("unsys_model")).toBeLessThan(ids.indexOf("edit"));
    expect(workspaceBlockDetailDrawerIds({ canEdit: false })).not.toContain(
      "unsys_model",
    );

    expect(view).toContain("handleSaveAnswersModelSeed");
    expect(view).toContain("onSaveAnswersModelSeed");
    expect(view).toContain("WorkspaceUnsysSeedStudio");
    expect(view).toContain("unsysStudioBlockId");
    expect(view).not.toContain("setUnsysStudioCatalogSize");
    expect(view).toContain("onOpenUnsysStudio");
    expect(drawers).toContain("onOpenUnsysStudio");
    expect(route).toContain("studentSessionModelFromAuthorSeed");
    expect(route).toContain("answers_model_seed");
    expect(route).toContain("authorSeedBlockIdFromPreparePlan");
    expect(route).toContain("sessionPrepareBlockId");
    expect(route).toContain("generateSessionBranchOpening");
    const sessionView = read("components/SessionView.tsx");
    const canvas = read("components/session-view/session-chapter-canvas.tsx");
    const phase = read("components/session-view/use-session-phase.ts");
    expect(sessionView).toContain("learnSessionFieldInput");
    expect(sessionView).toContain("blockId: sessionBlockId");
    expect(canvas).toContain("sessionPrepareBlockId");
    expect(phase).toContain("metadata: session.metadata");
    expect(update).toContain("answers_model_seed");
    expect(update).toContain("serializeAuthorUnsysModelSeed");

    writeEvidence(
      "author-model-manual-wiring.log",
      [
        "manualLabel=" + drawers.includes(MANUAL_MAP_MODE_LABEL),
        "surface=" + panel.includes("data-author-unsys-model"),
        "open=" + panel.includes("data-author-unsys-open"),
        "studio=" + studio.includes("data-author-unsys-studio"),
        "viewStudio=" + view.includes("WorkspaceUnsysSeedStudio"),
        "detailMount=" + detail.includes("WorkspaceBlockUnsysModelPanel"),
        "heliosHasSurface=" + chat.includes("data-author-unsys-model"),
        "learnerHasSurface=" + learner.includes("data-author-unsys-model"),
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
