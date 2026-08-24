import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readKnowledgePanelSurface } from "../helpers/surface-source";

const ROOT = join(__dirname, "../..");

const FEATURE_SURFACE_FILES = [
  // Core
  "lib/knowledge-config/types.ts",
  "lib/knowledge-config/math.ts",
  "lib/knowledge-config/encoder.ts",
  "lib/knowledge-config/index.ts",
  "lib/prompt-kernel/world-model.ts",
  "lib/pow-api/learning-world-model-store.ts",
  "lib/pow-api/knowledge-config-store.ts",
  "lib/pow-api/learner-state-engine.ts",
  "lib/pow-api/evaluation-subject.ts",
  "lib/pow-api/run-vertical-score.ts",
  // Snapshot API
  "app/api/v3/snapshot/workspaces/[id]/world-model/route.ts",
  "app/api/v3/snapshot/workspaces/[id]/knowledge-config/route.ts",
  "app/api/v3/snapshot/workspaces/[id]/knowledge-config/trajectory/route.ts",
  "app/api/v3/snapshot/workspaces/[id]/lwm-snapshot/route.ts",
  // Workspace UI API + panel
  "app/api/workspace/knowledge-config/route.ts",
  "components/KnowledgeConfigTrajectoryPanel.tsx",
  "components/knowledge-panel/widgets.tsx",
  "components/WorkspacePerformancePanel.tsx",
  // Migration + docs (historical create keeps brain_* name; forward renames to knowledge_*)
  "supabase/migrations/20260719140000_learning_world_model_brain_config.sql",
  "supabase/migrations/20260719190000_rename_brain_config_to_knowledge_config.sql",
  "docs/PROOF_OF_WORK_API.md",
] as const;

function read(rel: string) {
  if (rel.endsWith("KnowledgeConfigTrajectoryPanel.tsx")) {
    return readKnowledgePanelSurface();
  }
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("knowledge config / LWM feature surfaces", () => {
  it("ships all inventory files", () => {
    for (const rel of FEATURE_SURFACE_FILES) {
      expect(existsSync(join(ROOT, rel)), `missing ${rel}`).toBe(true);
    }
  });

  it("locks embedding model id and dim in types + migration", () => {
    const types = read("lib/knowledge-config/types.ts");
    expect(types).toContain('knowledgecfg-v1-d64');
    expect(types).toMatch(/KNOWLEDGE_CONFIG_DIM\s*=\s*64/);

    // Historical migration creates the original table name (do not rewrite applied SQL).
    const historical = read(
      "supabase/migrations/20260719140000_learning_world_model_brain_config.sql",
    );
    expect(historical).toContain("learning_world_models");
    expect(historical).toContain("brain_config_snapshots");
    expect(historical).toContain("braincfg-v1-d64");
    expect(historical).toMatch(/dim integer NOT NULL DEFAULT 64/);
    expect(historical).toContain("ENABLE ROW LEVEL SECURITY");

    // Forward migration renames product surface to knowledge configuration.
    const forward = read(
      "supabase/migrations/20260719190000_rename_brain_config_to_knowledge_config.sql",
    );
    expect(forward).toContain("knowledge_config_snapshots");
    expect(forward).toContain("knowledgecfg-v1-d64");
    expect(forward).toMatch(/RENAME TO knowledge_config_snapshots/);
  });

  it("Snapshot API routes require workspaces:read and document subject scoping", () => {
    for (const rel of [
      "app/api/v3/snapshot/workspaces/[id]/world-model/route.ts",
      "app/api/v3/snapshot/workspaces/[id]/knowledge-config/route.ts",
      "app/api/v3/snapshot/workspaces/[id]/knowledge-config/trajectory/route.ts",
    ] as const) {
      const src = read(rel);
      expect(src).toContain('authenticateRequest(req, "workspaces:read")');
      expect(src).toContain("resolveEvaluationSubject");
      expect(src).toContain("canAccessAgentWorkspace");
    }
  });

  it("score routes live under eval and call runVerticalScore", () => {
    const primary = read("app/api/v3/snapshot/workspaces/[id]/lwm-snapshot/route.ts");
    expect(primary).toContain("runVerticalScore");
    expect(primary).not.toContain("app/api/v2/");
    expect(primary).not.toContain("/api/v2/");
    for (const name of ["verification-score", "augmentation-score", "optimization-score"] as const) {
      expect(existsSync(join(ROOT, "app/api/v3/snapshot/workspaces/[id]", name, "route.ts"))).toBe(
        false,
      );
    }
  });

  it("score paths wire learner state + return knowledge_config fields", () => {
    const run = read("lib/pow-api/run-vertical-score.ts");
    expect(run).toContain("updateLearnerStateAfterScore");
    expect(run).toContain("learning_world_model");
    expect(run).toContain("knowledge_config");

    const primary = read("app/api/v3/snapshot/workspaces/[id]/lwm-snapshot/route.ts");
    expect(primary).toContain("learning_world_model");
    expect(primary).toContain("knowledge_config");

    const web = read("app/api/workspace/performance-report/route.ts");
    // Learner state update is inside runVerticalScore (shared generator).
    expect(web).toContain("runVerticalScore");
    expect(web).toContain("learning_world_model");
  });

  it("workspace performance UI exposes Models + LWM snapshot control (Eval tab removed)", () => {
    const panel = read("components/WorkspacePerformancePanel.tsx");
    expect(panel).toContain("KnowledgeConfigTrajectoryPanel");
    expect(panel).toContain('"knowledge"');
    expect(panel).toContain("performanceSubTabModels");
    // Eval tab removed — snapshot generation lives in LWM box.
    expect(panel).not.toContain("data-eval-subject-picker");
    expect(panel).not.toContain("subjectFocus");
    expect(panel).not.toContain('id: "score"');
    expect(panel).not.toContain("data-knowledge-eval");
    expect(panel).toContain("isOwner={isOwner}");

    const lwm = read("components/KnowledgeConfigTrajectoryPanel.tsx");
    expect(lwm).toContain("data-lwm-generate-snapshot");
    expect(lwm).toContain("/api/workspace/performance-report");
    expect(lwm).toContain("snapshot-history");
    expect(lwm).not.toContain('params.set("subject", "me")');
    // Timeline LWM: scores hero + dual trends + history selection
    expect(lwm).toContain("data-lwm-skill-card");
    expect(lwm).toContain("data-lwm-skill-score");
    expect(lwm).toContain("data-lwm-ghc-score");
    expect(lwm).toContain("data-lwm-last-updated");
    expect(lwm).toContain("data-lwm-snapshot-sidebar");
    expect(lwm).toContain("data-lwm-snapshot-list");
    expect(lwm).toContain("data-lwm-detail");
    expect(lwm).toContain("data-lwm-detail-tabs");
    expect(lwm).toContain("data-lwm-detail-spider");
    expect(lwm).toContain("loadSnapshotHistory");
    expect(lwm).toContain("selectedLwmRunId");
    expect(lwm).toContain("selectLwmHistoryRun");
    // No date-window history UI / separate report card grid
    expect(lwm).not.toContain("data-lwm-date-from");
    expect(lwm).not.toContain("data-lwm-score-trend");
    expect(lwm).not.toContain("defaultLwmTimelineDateWindow");
    expect(lwm).not.toContain("PerformanceReportCard");
    // Profile-zones layout: control → snapshot list + integrated detail
    expect(lwm).toContain('data-lwm-layout="profile-zones"');
    expect(lwm).toContain('data-lwm-zone="control"');
    expect(lwm).toContain('data-lwm-zone="overview"');
    expect(lwm).toContain('data-lwm-zone="report"');
    expect(lwm).toContain('data-lwm-zone="history"');
    expect(lwm).toContain("data-lwm-primary");
    expect(lwm).toContain("data-lwm-history-section");
    expect(lwm).toMatch(/lwmUpdatedLabel|last_eval_at|as_of/);
    // Filters + card; no long-form LWM-vs-embeddings teaching copy
    expect(lwm).toContain("data-lwm-filters");
    expect(lwm).toContain("data-lwm-controls-column");
    expect(lwm).toContain("data-lwm-card-column");
    expect(lwm).not.toContain("data-lwm-vs-embeddings");
    expect(lwm).not.toContain("data-lwm-ghc-explain");
    expect(lwm).not.toContain("data-lwm-split-layout");
  });

  it("Embeddings region overlay picker is always mounted with visible control surface", () => {
    const src = read("components/KnowledgeConfigTrajectoryPanel.tsx");
    expect(src).toContain("data-region-overlay-picker");
    // MoK-style collapsible region rail (label "Regions" + multi-select a11y name)
    expect(src).toContain("Knowledge regions multi-select");
    expect(src).toContain("data-region-overlay-loading");
    expect(src).toContain("data-region-overlay-empty");
    expect(src).toContain("data-region-overlay-error");
    expect(src).toContain("data-region-overlay-list");
    expect(src).toContain("data-region-overlay-toggle");
    expect(src).toContain("data-region-overlay-refresh");
    expect(src).toContain("loadRegionsForOverlay");
    expect(src).toContain("setRegionsLoading");
    expect(src).toContain("setRegionsError");
    // Empty state is a bordered surface, not only muted optional text.
    expect(src).toContain("data-region-overlay-empty");
    expect(src).toContain("No knowledge regions yet");
    // Selection still drives projection overlays.
    expect(src).toContain("regionOverlays");
    expect(src).toContain("selectedRegionIds");
    expect(src).toContain("ProjectionSpaceWidget");
    // Shared Project control also drives Local 3D / Global multi-algo layout.
    expect(src).toContain("data-map-3d-projection-select");
    expect(src).toContain("reprojectMapLayout");
  });

  it("Embeddings and LWM views do not stack duplicate page+section titles", () => {
    const src = read("components/KnowledgeConfigTrajectoryPanel.tsx");
    // No outer page-level h2 that repeats the Knowledge subtab name.
    expect(src).not.toMatch(/<h2[^>]*>\s*Embeddings\s*<\/h2>/);
    expect(src).not.toMatch(/<h2[^>]*>\s*Learning World Model\s*<\/h2>/);
    // Embeddings section marker + accessible name (not a nested page title).
    expect(src).toContain('data-section="embeddings-projections"');
    expect(src).toContain('aria-label="Embeddings Projections"');
    // LWM section has no nested title matching the tab label.
    expect(src).toContain('data-section="lwm"');
    const lwmBlock = src.slice(src.indexOf('data-section="lwm"'));
    // SectionCard for LWM should not pass title="Learning World Model".
    expect(lwmBlock).not.toMatch(
      /data-section="lwm"[\s\S]{0,120}title="Learning World Model"/,
    );
  });

  it("Embeddings uses left pickers + center canvas + right regions without whole-tab scroll", () => {
    const models = read("components/KnowledgeConfigTrajectoryPanel.tsx");
    expect(models).toContain('data-embeddings-layout="left-canvas-right-regions"');
    expect(models).toContain("data-embeddings-sidebar");
    expect(models).toContain("data-embeddings-projection");
    expect(models).toContain("data-embeddings-regions-rail");
    expect(models).toContain('data-picker="embeddings"');
    expect(models).toContain("data-region-overlay-picker");
    expect(models).toContain("data-projection-algorithm-picker");
    expect(models).toContain("data-projection-widget");
    // Left: user + algorithm; center: canvas; right: region multi-select + distances.
    const sidebarIdx = models.indexOf("data-embeddings-sidebar");
    const projectionIdx = models.indexOf("data-embeddings-projection");
    const railIdx = models.indexOf("data-embeddings-regions-rail");
    const pickerIdx = models.indexOf('data-picker="embeddings"');
    const algoPickerIdx = models.indexOf("data-projection-algorithm-picker");
    const regionPickerIdx = models.indexOf("data-region-overlay-picker");
    expect(sidebarIdx).toBeGreaterThan(-1);
    expect(projectionIdx).toBeGreaterThan(sidebarIdx);
    expect(railIdx).toBeGreaterThan(projectionIdx);
    expect(pickerIdx).toBeGreaterThan(sidebarIdx);
    expect(pickerIdx).toBeLessThan(projectionIdx);
    // Projection algorithm is compact chrome above the tall users list (fills left rail height).
    expect(algoPickerIdx).toBeGreaterThan(sidebarIdx);
    expect(algoPickerIdx).toBeLessThan(pickerIdx);
    expect(algoPickerIdx).toBeLessThan(projectionIdx);
    // Users list expands to fill remaining left-rail height (not max-h-40 only).
    expect(models).toContain("data-embeddings-user-list-fill");
    expect(models).toContain("fillHeight");
    expect(models).toMatch(/fillHeight[\s\S]{0,80}true|fillHeight\s*\/>/);
    // Region picker lives on the right rail (after projection in DOM).
    expect(regionPickerIdx).toBeGreaterThan(projectionIdx);
    expect(regionPickerIdx).toBeGreaterThan(railIdx);
    // Browser Fullscreen API for the embedding visual (covers navbar / full viewport).
    expect(models).toContain("data-embeddings-fullscreen");
    expect(models).toContain("data-embeddings-fullscreen-toggle");
    expect(models).toContain("data-embeddings-fullscreen-action");
    expect(models).toContain("data-embeddings-projection-surface");
    expect(models).toContain("embeddingsFullscreen");
    expect(models).toContain("enterEmbeddingsFullscreen");
    expect(models).toContain("exitEmbeddingsFullscreen");
    expect(models).toContain("embeddingsShellRef");
    expect(models).toContain("requestFullscreen");
    expect(models).toContain("exitFullscreen");
    expect(models).toContain("fullscreenchange");
    // CSS fallback still covers app chrome above navbar stacking context.
    expect(models).toContain("fixed inset-0");
    expect(models).toContain("z-[100]");
    // Fill-height flex; models root avoids overflow-y-auto (no whole-tab scroll).
    expect(models).toContain("overflow-hidden");
    expect(models).toMatch(
      /showModels\s*\?\s*[\s\S]*?overflow-hidden[\s\S]*?:\s*[\s\S]*?overflow-y-auto/,
    );
    // No nested SectionCard box around the whole embeddings stack.
    const embBlock = models.slice(
      models.indexOf('data-section="embeddings-projections"'),
      models.indexOf('data-section="lwm"') > -1
        ? models.indexOf('data-section="lwm"')
        : undefined,
    );
    expect(embBlock).not.toContain("rounded-xl border border-neutral-800 bg-neutral-950/40 p-4");
  });

  it("Models tab uses full-width embeddings + Custom Knowledge Regions; LWM is a separate tab", () => {
    const models = read("components/KnowledgeConfigTrajectoryPanel.tsx");
    expect(models).toContain("data-models-tab");
    expect(models).toContain('panelView = "models"');
    expect(models).toContain('panelView?: KnowledgePanelView');
    expect(models).toContain('"lwm"');
    // No global user / user_group / all scope creation UI.
    expect(models).not.toContain("data-models-scope-picker");
    expect(models).not.toContain('value="user_group"');
    expect(models).not.toContain('data-models-scope-mode');
    // Models: embeddings + regions; LWM has its own section gated by panelView.
    expect(models).toContain('data-section="embeddings-projections"');
    expect(models).toContain('data-section="lwm"');
    expect(models).toContain("showModels");
    expect(models).toContain("showLwm");
    expect(models).toContain('data-picker="embeddings"');
    expect(models).toContain('data-picker="lwm"');
    expect(models).toContain("data-models-user-picker");
    // Models: multi-select overlays (regions managed in Settings).
    expect(models).not.toContain("<CustomVerificationModelsPanel");
    expect(models).not.toContain('data-section="custom-models"');
    expect(models).toContain("data-region-overlay-picker");
    expect(models).toContain("projectTrajectoryAndRegions");
    expect(models).toContain("regionOverlays");
    expect(models).toContain("data-projection-widget");
    expect(models).toContain("data-projection-algorithm-select");
    expect(models).toContain("PROJECTION_ALGORITHM_OPTIONS");
    expect(models).toContain("projectionAlgorithm");
    expect(models).toContain("data-projection-professional");
    expect(models).toContain("data-projection-grid");
    expect(models).toContain("min-h-[28rem]");
    expect(models).toContain("loadRegionsForOverlay");

    const settings = read("components/WorkspaceIntegrationPanel.tsx");
    const settingsTabs = read("lib/workspace-settings-tabs.ts");
    expect(settings).toContain("CustomVerificationModelsPanel");
    expect(settings).toContain('data-settings-section="custom-knowledge-regions"');
    expect(settings).toContain("WorkspaceGuestLinksPanel");
    expect(settings).toContain('data-settings-section="guest-tap-ile"');
    expect(settings).toContain('data-settings-layout="tabs"');
    expect(settings).toContain("settingsSubTabsForKind");
    expect(settingsTabs).toContain('"regions"');
    expect(settingsTabs).toContain('"guest-links"');
    // Full width (no max-w-3xl constraint).
    expect(models).not.toContain("max-w-3xl");
    expect(models).toContain("w-full");
    expect(models).toContain("resolveModelsTabScope");
    expect(models).toContain("resolveEmbeddingsSubjectSelection");
    expect(models).toContain("EmbeddingsUserMultiPicker");
    expect(models).toContain('data-embeddings-user-multiselect="true"');
    expect(models).toContain("embSelectedKeys");
    expect(models).toContain("data-embeddings-user-toggle");
    // Left canvas right-regions layout (not the old projection|LWM grid).
    expect(models).toContain('data-embeddings-layout="left-canvas-right-regions"');
    expect(models).toContain("data-embeddings-regions-rail");
    expect(models).not.toContain("lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]");

    const panel = read("components/WorkspacePerformancePanel.tsx");
    expect(panel).toContain('panelView="models"');
    expect(panel).toContain('panelView="lwm"');
    expect(panel).toContain('panelView="ranking"');
    expect(panel).toContain('id: "lwm"');
    expect(panel).toContain('id: "ranking"');
    expect(panel).toContain("performanceSubTabLwm");
    expect(panel).toContain("performanceSubTabRanking");

    const api = read("app/api/workspace/knowledge-config/route.ts");
    expect(api).toContain("resolveModelsTabScopeFromRequest");
    expect(api).toContain("scope");
    expect(api).toContain("user_group");
    expect(api).toContain("aggregateLearningWorldModels");
    expect(api).not.toMatch(/const subject = \{ user_id: userId \}/);
  });

  it("Knowledge tab + workspace planView UI say user not learner", () => {
    const models = read("components/KnowledgeConfigTrajectoryPanel.tsx");
    // User-visible Knowledge/Models copy must not label people as learners.
    expect(models).not.toMatch(/\blearner(s)?\b/i);
    expect(models).toContain("data-lwm-timeline");
    expect(models).toContain("User");
    expect(models).not.toContain("data-lwm-vs-embeddings");

    const panel = read("components/WorkspacePerformancePanel.tsx");
    // Performance panel source must not expose learner-person wording in UI strings.
    // (Code comments may mention multi-user; domain ids like updateLearnerState stay elsewhere.)
    const panelUiStrings = panel.match(/(?:["'`])([^"'`]*)\1/g) ?? [];
    for (const lit of panelUiStrings) {
      expect(lit).not.toMatch(/\blearner(s)?\b/i);
    }

    const en = JSON.parse(read("messages/en.json")) as Record<
      string,
      Record<string, string> | undefined
    >;
    const planView = en.planView ?? {};
    // Every planView string that names a person must use user, not learner.
    for (const [key, value] of Object.entries(planView)) {
      if (typeof value !== "string") continue;
      expect(value, `planView.${key}`).not.toMatch(/\blearner(s)?\b/i);
    }
    expect(planView.performanceEvalSubjectLabel).toBe("User");
    expect(planView.performanceEvalSubjectAllHint).toMatch(/\busers?\b/i);
    expect(planView.forkToEditBody).toMatch(/another user/i);

    // Workspace builder / session chapter size copy (planMode + session namespaces).
    for (const ns of ["planMode", "session"] as const) {
      const bag = en[ns] ?? {};
      for (const key of ["initialChaptersMidDesc", "mapSizeMidDesc"] as const) {
        const value = bag[key];
        if (typeof value !== "string") continue;
        expect(value, `${ns}.${key}`).not.toMatch(/\blearner(s)?\b/i);
        expect(value, `${ns}.${key}`).toMatch(/most users/i);
      }
    }

    const community = en.communityPlans ?? {};
    if (community.description) {
      expect(community.description).not.toMatch(/\blearner(s)?\b/i);
      expect(community.description).toMatch(/other users/i);
    }
  });

  it("docs describe Snapshot API and model contract", () => {
    const docs = read("docs/PROOF_OF_WORK_API.md");
    expect(docs).toContain("/api/v3/snapshot");
    expect(docs).toContain("knowledge-config");
    expect(docs).toContain("world-model");
    expect(docs).toContain("knowledgecfg-v1-d64");
  });

  it("ontology names knowledge config dual layer", () => {
    const ontology = read("lib/prompt-kernel/ontology.ts");
    expect(ontology).toMatch(/Knowledge config/i);
    expect(ontology).toContain("knowledgecfg-v1-d64");
    expect(ontology).toContain("Evaluation");
  });

  it("PoW schema integration loads evidence appetite from durable LWM", () => {
    const src = read("lib/pow-api/proof-of-work-integration.ts");
    expect(src).toContain("loadLearningWorldModel");
    expect(src).toContain("formatEvidenceAppetiteGuidance");
    expect(src).toContain("worldModelAppetiteGuidance");
  });
});
