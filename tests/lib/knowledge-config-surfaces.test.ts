import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
  "components/WorkspacePerformancePanel.tsx",
  // Migration + docs (historical create keeps brain_* name; forward renames to knowledge_*)
  "supabase/migrations/20260719140000_learning_world_model_brain_config.sql",
  "supabase/migrations/20260719190000_rename_brain_config_to_knowledge_config.sql",
  "docs/PROOF_OF_WORK_API.md",
] as const;

function read(rel: string) {
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
    // Skill-card LWM display + visible last-snapshot stamp
    expect(lwm).toContain("data-lwm-skill-card");
    expect(lwm).toContain("data-lwm-skill-score");
    expect(lwm).toContain("data-lwm-last-updated");
    expect(lwm).toContain("Last snapshot");
    expect(lwm).toMatch(/lwmUpdatedLabel|last_eval_at|as_of/);
    // Split layout: controls + LWM vs embeddings copy | skill card
    expect(lwm).toContain("data-lwm-split-layout");
    expect(lwm).toContain("data-lwm-controls-column");
    expect(lwm).toContain("data-lwm-card-column");
    expect(lwm).toContain("data-lwm-vs-embeddings");
    expect(lwm).toMatch(/LWM \(this tab\)|symbolic skill card/);
    expect(lwm).toMatch(/Embeddings \(Models tab\)|geometry over time/);
  });

  it("Embeddings region overlay picker is always mounted with visible control surface", () => {
    const src = read("components/KnowledgeConfigTrajectoryPanel.tsx");
    expect(src).toContain("data-region-overlay-picker");
    expect(src).toContain("Overlay knowledge regions");
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

  it("Embeddings uses left sidebar pickers + right projection without whole-tab scroll", () => {
    const models = read("components/KnowledgeConfigTrajectoryPanel.tsx");
    expect(models).toContain('data-embeddings-layout="sidebar-projection"');
    expect(models).toContain("data-embeddings-sidebar");
    expect(models).toContain("data-embeddings-projection");
    expect(models).toContain('data-picker="embeddings"');
    expect(models).toContain("data-region-overlay-picker");
    expect(models).toContain("data-projection-algorithm-picker");
    expect(models).toContain("data-projection-widget");
    // Sidebar hosts user + projection algorithm + region pickers; canvas is the right pane.
    const sidebarIdx = models.indexOf("data-embeddings-sidebar");
    const projectionIdx = models.indexOf("data-embeddings-projection");
    const pickerIdx = models.indexOf('data-picker="embeddings"');
    const algoPickerIdx = models.indexOf("data-projection-algorithm-picker");
    const regionPickerIdx = models.indexOf("data-region-overlay-picker");
    expect(sidebarIdx).toBeGreaterThan(-1);
    expect(projectionIdx).toBeGreaterThan(sidebarIdx);
    expect(pickerIdx).toBeGreaterThan(sidebarIdx);
    expect(pickerIdx).toBeLessThan(projectionIdx);
    // Projection dropdown sits directly under the user dropdown in the sidebar.
    expect(algoPickerIdx).toBeGreaterThan(pickerIdx);
    expect(algoPickerIdx).toBeLessThan(regionPickerIdx);
    expect(algoPickerIdx).toBeLessThan(projectionIdx);
    expect(regionPickerIdx).toBeGreaterThan(sidebarIdx);
    expect(regionPickerIdx).toBeLessThan(projectionIdx);
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
    expect(settings).toContain("CustomVerificationModelsPanel");
    expect(settings).toContain('data-settings-section="custom-knowledge-regions"');
    expect(settings).toContain("WorkspaceGuestLinksPanel");
    expect(settings).toContain('data-settings-section="guest-tap-ile"');
    expect(settings).toContain('data-settings-layout="tabs"');
    expect(settings).toContain('id: "regions"');
    expect(settings).toContain('id: "guest-links"');
    // Full width (no max-w-3xl constraint).
    expect(models).not.toContain("max-w-3xl");
    expect(models).toContain("w-full");
    expect(models).toContain("resolveModelsTabScope");
    // Sidebar + projection layout (not the old projection|LWM grid).
    expect(models).toContain('data-embeddings-layout="sidebar-projection"');
    expect(models).not.toContain("lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]");

    const panel = read("components/WorkspacePerformancePanel.tsx");
    expect(panel).toContain('panelView="models"');
    expect(panel).toContain('panelView="lwm"');
    expect(panel).toContain('id: "lwm"');
    expect(panel).toContain("performanceSubTabLwm");

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
    expect(models).toContain("Select a user, generate a snapshot");
    expect(models).toContain("User");
    expect(models).toContain("data-lwm-vs-embeddings");

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
