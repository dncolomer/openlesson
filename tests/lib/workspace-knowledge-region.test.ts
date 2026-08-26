/**
 * Knowledge Region workspace kind: create mode, shell, settings, mint deny,
 * zero-block PoW surfaces, and cross-workspace embeddings import overlay.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  isUiWorkspaceCreateMode,
  knowledgeRegionWorkspaceCreateOutcome,
  parseWorkspaceCreateMode,
  UI_WORKSPACE_CREATE_MODES,
  workspaceKindForCreateMode,
} from "@/lib/workspace-create-modes";
import {
  availableWorkspaceSections,
  defaultWorkspaceSection,
  resolveActiveSection,
} from "@/lib/workspace-sections";
import {
  availableSectionsForMode,
  resolveActiveSectionForMode,
} from "@/lib/workspace-mode";
import {
  assertWorkspaceAllowsKnowledgeLinkMint,
  isKnowledgeRegionWorkspace,
  parseWorkspaceKind,
  workspaceAllowsKnowledgeLinkMint,
} from "@/lib/workspace-kind";
import {
  availableSettingsSubviews,
  defaultSettingsSubview,
  resolveSettingsSubview,
  settingsSubviewLabel,
} from "@/lib/workspace-settings-tabs";
import { encodeKnowledgeConfig, l2Norm } from "@/lib/knowledge-config";
import { projectTrajectoryAndRegions } from "@/lib/knowledge-config";
import {
  assembleSelectedRegionOverlayInputs,
  filterImportableKnowledgeRegions,
} from "@/lib/knowledge-region-import";
import { normalizeGoalText } from "@/lib/pow-api/goals";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { buildWorkspaceSectionNavItems } from "@/components/workspace-view/workspace-section-nav-items";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-abd9ab8e0040/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("Knowledge Region create mode", () => {
  it("is a UI-selectable mode beside blank and template; files_goal stays non-UI", () => {
    expect(UI_WORKSPACE_CREATE_MODES).toEqual([
      "blank",
      "template",
      "knowledge_region",
    ]);
    expect(isUiWorkspaceCreateMode("blank")).toBe(true);
    expect(isUiWorkspaceCreateMode("template")).toBe(true);
    expect(isUiWorkspaceCreateMode("knowledge_region")).toBe(true);
    expect(isUiWorkspaceCreateMode("files_goal")).toBe(false);
    expect(parseWorkspaceCreateMode("knowledge_region")).toBe("knowledge_region");
    expect(parseWorkspaceCreateMode("knowledge-region")).toBe("knowledge_region");
    expect(parseWorkspaceCreateMode("knowledgeRegion")).toBe("knowledge_region");
    expect(parseWorkspaceCreateMode("kr")).toBe("knowledge_region");
    expect(parseWorkspaceCreateMode("not-a-mode")).toBeNull();
    expect(workspaceKindForCreateMode("knowledge_region")).toBe("knowledge_region");
    expect(workspaceKindForCreateMode("blank")).toBe("standard");
    const outcome = knowledgeRegionWorkspaceCreateOutcome();
    expect(outcome.blocks).toEqual([]);
    expect(outcome.mode).toBe("knowledge_region");
    expect(outcome.workspaceKind).toBe("knowledge_region");

    const nested = errorMessageFromBody(
      { error: { code: "internal_error", message: "column workspace_kind does not exist" } },
      "fallback",
    );
    expect(nested).toBe("column workspace_kind does not exist");
    expect(nested).not.toBe("[object Object]");
    expect(errorMessageFromBody({ error: { code: "x" } }, "Failed KR")).toBe("Failed KR");

    writeScratch(
      "knowledge-region-create-mode.log",
      [
        `UI_WORKSPACE_CREATE_MODES=${JSON.stringify(UI_WORKSPACE_CREATE_MODES)}`,
        `isUi_blank=${isUiWorkspaceCreateMode("blank")}`,
        `isUi_template=${isUiWorkspaceCreateMode("template")}`,
        `isUi_knowledge_region=${isUiWorkspaceCreateMode("knowledge_region")}`,
        `isUi_files_goal=${isUiWorkspaceCreateMode("files_goal")}`,
        `parse_knowledge_region=${parseWorkspaceCreateMode("knowledge_region")}`,
        `parse_alias=${parseWorkspaceCreateMode("knowledge-region")}`,
        `parse_invalid=${parseWorkspaceCreateMode("legacy-blank")}`,
        `kind_for_kr=${workspaceKindForCreateMode("knowledge_region")}`,
        `kr_blocks=${outcome.blocks.length}`,
      ].join("\n") + "\n",
    );
  });
});

describe("Knowledge Region shell", () => {
  it("owner sections are goals/knowledge/settings; default and hidden fall back to goals", () => {
    const owner = availableWorkspaceSections({
      isOwner: true,
      workspaceKind: "knowledge_region",
    });
    expect(owner).toEqual(["goals", "knowledge", "settings"]);
    const t = (key: string) => key;
    const krNav = buildWorkspaceSectionNavItems({
      t,
      isLearnerMode: false,
      isOwner: true,
      visibleSections: owner,
    });
    expect(krNav.map((item) => item.key)).toEqual([
      "goals",
      "knowledge",
      "settings",
    ]);
    expect(krNav.map((item) => item.key)).not.toContain("workspace");
    const standardNav = buildWorkspaceSectionNavItems({
      t,
      isLearnerMode: false,
      isOwner: true,
      visibleSections: availableWorkspaceSections({ isOwner: true }),
    });
    expect(standardNav.map((item) => item.key)[0]).toBe("workspace");
    expect(standardNav.map((item) => item.key)).toContain("workspace");
    expect(defaultWorkspaceSection("knowledge_region")).toBe("goals");
    expect(
      resolveActiveSection("workspace", {
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).toBe("goals");
    expect(
      resolveActiveSection("dags", {
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).toBe("goals");
    expect(
      resolveActiveSectionForMode({
        mode: "creator",
        requested: "simulation",
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).toBe("goals");
    expect(
      resolveActiveSectionForMode({
        mode: "creator",
        requested: "goals",
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).toBe("goals");
    expect(
      availableSectionsForMode({
        mode: "learner",
        isOwner: true,
        isLoggedIn: true,
        workspaceKind: "knowledge_region",
      }),
    ).toEqual(["knowledge"]);
    expect(
      availableSectionsForMode({
        mode: "learner",
        isLoggedIn: true,
        workspaceKind: "knowledge_region",
      }).includes("workspace"),
    ).toBe(false);

    const nonOwner = availableWorkspaceSections({
      isOwner: false,
      workspaceKind: "knowledge_region",
    });
    expect(nonOwner).toEqual([]);
    expect(
      resolveActiveSection("settings", {
        isOwner: false,
        workspaceKind: "knowledge_region",
      }),
    ).toBe("goals");

    const normal = availableWorkspaceSections({ isOwner: true });
    expect(normal).toEqual([
      "workspace",
      "dags",
      "goals",
      "context",
      "simulation",
      "knowledge",
      "settings",
    ]);
    expect(defaultWorkspaceSection("standard")).toBe("workspace");
    expect(resolveActiveSection("settings", { isOwner: false })).toBe("workspace");

    const krTabs = availableSettingsSubviews("knowledge_region");
    expect([...krTabs]).toEqual(["general", "regions", "data-studio", "integrations"]);
    expect(defaultSettingsSubview("knowledge_region")).toBe("general");
    expect(resolveSettingsSubview("general", "knowledge_region")).toBe("general");
    expect(resolveSettingsSubview("guest-links", "knowledge_region")).toBe("general");
    const identitySettings = readFileSync(
      join(ROOT, "components/WorkspaceIdentitySettings.tsx"),
      "utf8",
    );
    const integrationPanel = readFileSync(
      join(ROOT, "components/WorkspaceIntegrationPanel.tsx"),
      "utf8",
    );
    expect(identitySettings).toContain("workspace-settings-title");
    expect(identitySettings).toContain("workspace-settings-description");
    expect(integrationPanel).toContain("WorkspaceIdentitySettings");
    expect(integrationPanel).toContain('activeSubview === "general"');
    expect(settingsSubviewLabel("integrations", "knowledge_region")).toBe("Integration");
    expect(settingsSubviewLabel("regions", "knowledge_region")).toBe("Knowledge Regions");
    expect(settingsSubviewLabel("data-studio", "knowledge_region")).toBe("Data Studio");

    const fullTabs = availableSettingsSubviews("standard");
    expect(fullTabs).toContain("general");
    expect(fullTabs).toContain("aycl");
    expect(fullTabs).toContain("guest-links");
    expect(fullTabs).toContain("knowledge-portal");
    expect(defaultSettingsSubview("standard")).toBe("general");

    writeScratch(
      "knowledge-region-shell.log",
      [
        `kr_owner_sections=${JSON.stringify(owner)}`,
        `kr_nav_keys=${JSON.stringify(krNav.map((item) => item.key))}`,
        `kr_default=${defaultWorkspaceSection("knowledge_region")}`,
        `kr_hidden_workspace=${resolveActiveSection("workspace", { isOwner: true, workspaceKind: "knowledge_region" })}`,
        `kr_non_owner=${JSON.stringify(nonOwner)}`,
        `kr_settings=${JSON.stringify([...krTabs])}`,
        `kr_settings_default=${defaultSettingsSubview("knowledge_region")}`,
        `kr_integration_label=${settingsSubviewLabel("integrations", "knowledge_region")}`,
        `normal_owner_sections=${JSON.stringify(normal)}`,
        `normal_settings_has_guest_links=${fullTabs.includes("guest-links")}`,
      ].join("\n") + "\n",
    );
  });
});

describe("Knowledge Region knowledge-link deny", () => {
  it("denies mint on KR and allows it on standard; mint routes consult the helper", () => {
    expect(workspaceAllowsKnowledgeLinkMint("knowledge_region")).toBe(false);
    expect(workspaceAllowsKnowledgeLinkMint("standard")).toBe(true);
    expect(workspaceAllowsKnowledgeLinkMint(undefined)).toBe(true);
    expect(assertWorkspaceAllowsKnowledgeLinkMint("knowledge_region")).toEqual({
      ok: false,
      error: expect.stringMatching(/Knowledge Region/i) as unknown as string,
      code: "forbidden",
    });
    expect(assertWorkspaceAllowsKnowledgeLinkMint("standard")).toEqual({ ok: true });
    expect(isKnowledgeRegionWorkspace(parseWorkspaceKind("knowledge_region"))).toBe(
      true,
    );

    const tap = read("app/api/workspace/tap-links/route.ts");
    const ile = read("app/api/workspace/ile-links/route.ts");
    const tapbench = read("app/api/workspace/tapbench-links/route.ts");
    expect(tap).toContain("assertWorkspaceAllowsKnowledgeLinkMint");
    expect(ile).toContain("assertWorkspaceAllowsKnowledgeLinkMint");
    expect(tapbench).toContain("assertWorkspaceAllowsKnowledgeLinkMint");
    expect(read("lib/pow-api/create-tap-link.ts")).toContain(
      "workspaceAllowsKnowledgeLinkMint",
    );
    expect(read("lib/pow-api/create-ile-link.ts")).toContain(
      "workspaceAllowsKnowledgeLinkMint",
    );
    expect(read("lib/pow-api/create-tapbench-link.ts")).toContain(
      "workspaceAllowsKnowledgeLinkMint",
    );

    writeScratch(
      "knowledge-region-no-links.log",
      [
        `kr_allows=${workspaceAllowsKnowledgeLinkMint("knowledge_region")}`,
        `standard_allows=${workspaceAllowsKnowledgeLinkMint("standard")}`,
        `kr_assert=${JSON.stringify(assertWorkspaceAllowsKnowledgeLinkMint("knowledge_region"))}`,
        `standard_assert=${JSON.stringify(assertWorkspaceAllowsKnowledgeLinkMint("standard"))}`,
        `tap_route_consults=${tap.includes("assertWorkspaceAllowsKnowledgeLinkMint")}`,
        `ile_route_consults=${ile.includes("assertWorkspaceAllowsKnowledgeLinkMint")}`,
        `tapbench_route_consults=${tapbench.includes("assertWorkspaceAllowsKnowledgeLinkMint")}`,
      ].join("\n") + "\n",
    );
  });
});

describe("Knowledge Region zero-block PoW surfaces", () => {
  it("goals list/add, encoder, regions, and data studio do not require blocks or TAP mint", () => {
    expect(normalizeGoalText("  Ship PoW  ")).toBe("Ship PoW");
    const goalsStore = read("lib/pow-api/goals-store.ts");
    expect(goalsStore).toContain("export async function listWorkspaceGoals");
    expect(goalsStore).toContain("export async function createWorkspaceGoal");
    const createFn = goalsStore.slice(
      goalsStore.indexOf("export async function createWorkspaceGoal"),
      goalsStore.indexOf("export async function updateWorkspaceGoal"),
    );
    expect(createFn).toContain("workspace_id");
    expect(createFn).toContain("text");
    expect(createFn).not.toContain("block_id");
    expect(createFn).not.toMatch(/tap|ile|tapbench/i);

    const encoded = encodeKnowledgeConfig({
      workspaceId: "kr-ws",
      totalBlocks: 0,
      powRows: [
        {
          proof_of_work_type: "tool",
          timestamp_ms: 1_700_000_000_000,
          tool_name: "cli",
          metadata: { note: "external pow" },
        },
        {
          proof_of_work_type: "screen",
          timestamp_ms: 1_700_000_001_000,
          metadata: {},
        },
      ],
    });
    expect(encoded.vector.every((x) => Number.isFinite(x))).toBe(true);
    expect(Math.abs(l2Norm(encoded.vector) - 1)).toBeLessThan(1e-6);
    expect(encoded.pow_event_count).toBe(2);

    const regionsPanel = read("components/CustomVerificationModelsPanel.tsx");
    expect(regionsPanel).toContain("/api/workspace/custom-knowledge-regions");
    expect(regionsPanel).not.toMatch(/required.*blockId|blockId is required/i);
    const regionsStore = read("lib/pow-api/custom-verification-model-store.ts");
    expect(regionsStore).toContain("listCustomVerificationModels");
    expect(regionsStore).toContain("listSubjectsWithKnowledgeConfig");
    expect(regionsStore).not.toMatch(/block_id.*required/);

    const dataStudio = read("components/WorkspaceDataStudioPanel.tsx");
    expect(dataStudio).toContain("/api/workspace/data-studio/pow");
    expect(dataStudio).toContain("data-workspace-data-studio");

    const goalsPanel = read("components/WorkspaceGoalsPanel.tsx");
    expect(goalsPanel).toContain("/api/workspace/goals");

    writeScratch(
      "knowledge-region-pow-surfaces.log",
      [
        `goal_text=${normalizeGoalText("  Ship PoW  ")}`,
        `create_workspace_goal_has_block_id=${createFn.includes("block_id")}`,
        `encoder_dim=${encoded.dim}`,
        `encoder_finite=${encoded.vector.every((x) => Number.isFinite(x))}`,
        `encoder_norm=${l2Norm(encoded.vector)}`,
        `encoder_pow_count=${encoded.pow_event_count}`,
        `encoder_total_blocks=0`,
        `data_studio_pow_route=${dataStudio.includes("/api/workspace/data-studio/pow")}`,
        `regions_no_block_required=${!regionsPanel.match(/blockId is required/i)}`,
      ].join("\n") + "\n",
    );
  });
});

describe("Knowledge Region embeddings import overlay", () => {
  it("imports owned-foreign regions into the shipped projector and excludes non-owned", () => {
    const caller = "user-owner";
    const current = "ws-current";
    const ownedOther = "ws-owned";
    const notOwned = "ws-foreign";
    const owned = [
      { id: current, user_id: caller, title: "Current" },
      { id: ownedOther, user_id: caller, title: "Other KR" },
      { id: notOwned, user_id: "someone-else", title: "Not mine" },
    ];
    const localCentroid = new Array(8).fill(0);
    localCentroid[0] = 1;
    const importedCentroid = new Array(8).fill(0);
    importedCentroid[1] = 1;
    const foreignCentroid = new Array(8).fill(0);
    foreignCentroid[2] = 1;

    const importable = filterImportableKnowledgeRegions({
      callerUserId: caller,
      currentWorkspaceId: current,
      ownedWorkspaces: owned,
      regions: [
        {
          id: "r-local",
          workspace_id: current,
          name: "Local region",
          centroid: localCentroid,
        },
        {
          id: "r-owned",
          workspace_id: ownedOther,
          name: "Imported KR",
          centroid: importedCentroid,
          mean_radius: 0.3,
          cosine_threshold: 0.6,
        },
        {
          id: "r-foreign",
          workspace_id: notOwned,
          name: "Should drop",
          centroid: foreignCentroid,
        },
      ],
    });
    expect(importable.map((r) => r.id)).toEqual(["r-owned"]);
    expect(importable.some((r) => r.id === "r-foreign")).toBe(false);
    expect(importable[0]?.workspace_title).toBe("Other KR");

    const overlays = assembleSelectedRegionOverlayInputs({
      localRegions: [
        {
          id: "r-local",
          name: "Local region",
          centroid: localCentroid,
          mean_radius: 0.2,
          cosine_threshold: 0.5,
        },
      ],
      importedRegions: importable.map((r) => ({
        id: r.id,
        name: r.name,
        centroid: (r.centroid as number[]) || [],
        mean_radius: r.mean_radius,
        cosine_threshold: r.cosine_threshold,
        workspace_id: r.workspace_id,
        imported: true,
      })),
      selectedIds: ["r-local", "r-owned", "r-foreign"],
    });
    expect(overlays.map((o) => o.id).sort()).toEqual(["r-local", "r-owned"].sort());
    expect(overlays.find((o) => o.id === "r-owned")?.name).toBe("Imported KR");
    expect(overlays.find((o) => o.id === "r-foreign")).toBeUndefined();

    const layout = projectTrajectoryAndRegions({
      points: [
        {
          t: "t0",
          as_of_ms: 1,
          vector: localCentroid,
          confidence: 0.8,
        },
      ],
      regions: overlays,
      algorithm: "random",
    });
    expect(layout.regionOverlays).toHaveLength(2);
    const importedOverlay = layout.regionOverlays.find((o) => o.id === "r-owned");
    expect(importedOverlay?.name).toBe("Imported KR");
    expect(Number.isFinite(importedOverlay?.x)).toBe(true);
    expect(Number.isFinite(importedOverlay?.y)).toBe(true);
    expect((importedOverlay?.radius ?? 0) > 0).toBe(true);

    writeScratch(
      "knowledge-region-import-overlay.log",
      [
        `importable_ids=${JSON.stringify(importable.map((r) => r.id))}`,
        `excluded_foreign=${!importable.some((r) => r.id === "r-foreign")}`,
        `overlay_ids=${JSON.stringify(overlays.map((o) => o.id))}`,
        `imported_name=${importedOverlay?.name}`,
        `imported_x_finite=${Number.isFinite(importedOverlay?.x)}`,
        `imported_y_finite=${Number.isFinite(importedOverlay?.y)}`,
        `imported_radius=${importedOverlay?.radius}`,
      ].join("\n") + "\n",
    );
  });
});

describe("Knowledge Region wiring", () => {
  it("create page, generate path, shell, settings, mint, embeddings import are wired", () => {
    const page = read("app/workspace/new/page.tsx");
    expect(page).toContain("Knowledge Region");
    expect(page).toContain("data-create-mode={card.mode}");
    expect(page).toContain('data-create-mode="knowledge_region"');
    expect(page).toContain('data-create-layout="3-plus-1"');
    expect(page).toContain('data-create-mode-span="knowledge_region"');
    expect(page).toContain("knowledge_region:");
    expect(page).toContain('createMode: "knowledge_region"');
    expect(page).toContain("handleCreateKnowledgeRegion");
    expect(page).toContain("errorMessageFromBody");
    expect(page).not.toContain("payload.error ||");

    const gen = read("app/api/workspace/generate/route.ts");
    expect(gen).toContain('createMode === "knowledge_region"');
    expect(gen).toContain("workspace_kind: krOutcome.workspaceKind");
    expect(gen).toContain("knowledgeRegionWorkspaceCreateOutcome");

    const view = read("components/WorkspaceView.tsx");
    expect(view).toContain("parseWorkspaceKind");
    expect(view).toContain("workspaceKind");
    expect(view).toContain("defaultWorkspaceSection");
    expect(view).toContain("resolvedSection");
    expect(view).toContain("buildWorkspaceSectionNavItems");
    const navItems = read("components/workspace-view/workspace-section-nav-items.tsx");
    expect(navItems).toContain('visibleSections.includes("workspace")');

    const settings = read("components/WorkspaceIntegrationPanel.tsx");
    expect(settings).toContain("settingsSubTabsForKind");
    expect(settings).toContain("settingsShowsKnowledgeLinks");
    expect(settings).toContain("showKnowledgeLinks && activeSubview === \"guest-links\"");

    const models = read("components/knowledge-panel/models-view.tsx");
    expect(models).toContain("data-region-import-toggle");
    expect(models).toContain("importRegionOverlay");
    expect(models).toContain("importableRegions");

    const embeddings = read("components/knowledge-panel/use-knowledge-embeddings.ts");
    expect(embeddings).toContain("assembleSelectedRegionOverlayInputs");
    expect(embeddings).toContain("importable_models");

    const regionsApi = read("app/api/workspace/custom-knowledge-regions/route.ts");
    expect(regionsApi).toContain("listImportableKnowledgeRegionsForOwner");
    expect(regionsApi).toContain("importable_models");

    const migration = read("supabase/migrations/20260823120000_workspace_kind.sql");
    expect(migration).toContain("workspace_kind");
    expect(migration).toContain("knowledge_region");

    writeScratch(
      "knowledge-region-wiring.log",
      [
        "create_card=Knowledge Region",
        `create_posts_kr=${page.includes('createMode: "knowledge_region"')}`,
        `generate_persists_kind=${gen.includes("workspace_kind: krOutcome.workspaceKind")}`,
        `shell_uses_kind=${view.includes("parseWorkspaceKind")}`,
        `settings_hides_guest_links=${settings.includes("showKnowledgeLinks && activeSubview === \"guest-links\"")}`,
        `embeddings_import=${models.includes("data-region-import-toggle")}`,
        `hook_assemble=${embeddings.includes("assembleSelectedRegionOverlayInputs")}`,
        `api_importable=${regionsApi.includes("importable_models")}`,
        `migration=${migration.includes("knowledge_region")}`,
      ].join("\n") + "\n",
    );
  });
});
