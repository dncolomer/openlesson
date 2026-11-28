/**
 * Knowledge Region workspace kind: create mode, shell, settings, mint deny,
 * zero-block PoW surfaces, and cross-workspace embeddings import overlay.
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  isUiWorkspaceCreateMode,
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
  defaultInteractionModeForWorkspace,
  resolveActiveSectionForMode,
} from "@/lib/workspace-mode";
import {
  assertWorkspaceAllowsKnowledgeLinkMint,
  isCalibrationWorkspace,
  isKnowledgeRegionWorkspace,
  parseWorkspaceKind,
  workspaceAllowsKnowledgeLinkMint,
  workspaceKnowledgeFlowKind,
} from "@/lib/workspace-kind";
import {
  availableSettingsSubviews,
  defaultSettingsSubview,
  resolveSettingsSubview,
  settingsSubviewLabel,
} from "@/lib/workspace-settings-tabs";
import { l2Norm } from "@/lib/knowledge-config";
import { FLOW_EMBEDDING_DIM } from "@/lib/flow-embedding";
import { encodeTextsToFlowVector } from "@/lib/flow-embedding-encode";
import { tmpdir } from "node:os";
import { projectTrajectoryAndRegions } from "@/lib/knowledge-config";
import {
  assembleSelectedRegionOverlayInputs,
  filterImportableKnowledgeRegions,
} from "@/lib/knowledge-region-import";
import { normalizeGoalText } from "@/lib/pow-api/goals";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  calibrationWorkspaceFeatures,
  verificationWorkspaceFeatures,
  workspaceSupportsFeature,
} from "@/lib/workspace-capabilities";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-abd9ab8e0040/implementer");

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("Knowledge Region create mode", () => {
  it("stays an internal owner-container mode; Learning create is blank-only", async () => {
    expect(UI_WORKSPACE_CREATE_MODES).toEqual(["blank"]);
    expect(isUiWorkspaceCreateMode("blank")).toBe(true);
    expect(isUiWorkspaceCreateMode("template")).toBe(false);
    expect(isUiWorkspaceCreateMode("knowledge_region")).toBe(false);
    expect(isUiWorkspaceCreateMode("calibration")).toBe(false);
    expect(isUiWorkspaceCreateMode("files_goal")).toBe(false);
    expect(parseWorkspaceCreateMode("knowledge_region")).toBe("knowledge_region");
    expect(parseWorkspaceCreateMode("knowledge-region")).toBe("knowledge_region");
    expect(parseWorkspaceCreateMode("knowledgeRegion")).toBe("knowledge_region");
    expect(parseWorkspaceCreateMode("kr")).toBe("knowledge_region");
    expect(parseWorkspaceCreateMode("not-a-mode")).toBeNull();
    expect(workspaceKindForCreateMode("knowledge_region")).toBe("standard");
    expect(workspaceKindForCreateMode("calibration")).toBe("standard");
    expect(workspaceKindForCreateMode("blank")).toBe("standard");
    expect(parseWorkspaceCreateMode("calibration")).toBe("calibration");
    expect(parseWorkspaceKind("calibration")).toBe("standard");
    expect(isCalibrationWorkspace("calibration")).toBe(false);
    expect(isCalibrationWorkspace("knowledge_region")).toBe(false);
    expect(workspaceKnowledgeFlowKind("calibration")).toBeNull();
    expect(workspaceKnowledgeFlowKind("knowledge_region")).toBeNull();
    expect(workspaceKnowledgeFlowKind("standard")).toBeNull();

    const nested = errorMessageFromBody(
      { error: { code: "internal_error", message: "column workspace_kind does not exist" } },
      "fallback",
    );
    expect(nested).toBe("column workspace_kind does not exist");
    expect(nested).not.toBe("[object Object]");
    expect(errorMessageFromBody({ error: { code: "x" } }, "Failed KR")).toBe("Failed KR");

    expect(verificationWorkspaceFeatures()).toContain("verification_flows");
    expect(verificationWorkspaceFeatures()).not.toContain("calibration_flows");
    expect(calibrationWorkspaceFeatures()).toContain("calibration_flows");
    expect(calibrationWorkspaceFeatures()).not.toContain("verification_flows");
    expect(workspaceSupportsFeature("knowledge_region", "calibration_flows")).toBe(false);
    expect(workspaceSupportsFeature("calibration", "verification_flows")).toBe(false);
    expect(workspaceSupportsFeature("calibration", "calibration_flows")).toBe(false);
    expect(workspaceSupportsFeature("standard", "calibration_flows")).toBe(false);
    expect(workspaceSupportsFeature("standard", "make_public")).toBe(true);
    expect(workspaceSupportsFeature("knowledge_region", "make_public")).toBe(true);
    expect(workspaceSupportsFeature("knowledge_region", "map")).toBe(true);

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
      ].join("\n") + "\n",
    );
  });
});

describe("Knowledge Region shell", () => {
  it("leftover kinds parse as Learning sections and do not invent a Goals tab", async () => {
    const owner = availableWorkspaceSections({
      isOwner: true,
      workspaceKind: "knowledge_region",
    });
    expect(owner).toEqual([
      "workspace",
      "dags",
      "map_types",
      "unsys_models",
      "context",
      "settings",
    ]);
    expect(owner).toContain("workspace");
    expect(owner).not.toContain("goals");
    expect(owner).not.toContain("verification_flows");
    expect(defaultInteractionModeForWorkspace("knowledge_region")).toBe("learner");
    expect(defaultInteractionModeForWorkspace("standard")).toBe("learner");
    const learnerKr = availableSectionsForMode({
      mode: "learner",
      isOwner: true,
      isLoggedIn: true,
      workspaceKind: "knowledge_region",
    });
    expect(learnerKr).toContain("workspace");
    expect(availableWorkspaceSections({ isOwner: true })[0]).toBe("workspace");
    expect(defaultWorkspaceSection("knowledge_region")).toBe("workspace");
    expect(
      resolveActiveSection("workspace", {
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).toBe("workspace");
    expect(
      resolveActiveSection("dags", {
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).toBe("dags");
    expect(
      resolveActiveSection("goals", {
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).toBe("workspace");
    expect(
      resolveActiveSectionForMode({
        mode: "creator",
        requested: "simulation",
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).toBe("workspace");
    expect(
      resolveActiveSectionForMode({
        mode: "creator",
        requested: "goals",
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).toBe("workspace");
    expect(
      availableSectionsForMode({
        mode: "learner",
        isOwner: true,
        isLoggedIn: true,
        workspaceKind: "knowledge_region",
      }),
    ).toEqual(
      availableSectionsForMode({
        mode: "learner",
        isOwner: true,
        isLoggedIn: true,
        workspaceKind: "standard",
      }),
    );
    expect(
      availableSectionsForMode({
        mode: "learner",
        isLoggedIn: true,
        workspaceKind: "knowledge_region",
      }).includes("workspace"),
    ).toBe(true);

    const nonOwner = availableWorkspaceSections({
      isOwner: false,
      workspaceKind: "knowledge_region",
    });
    expect(nonOwner).toEqual(["workspace"]);
    expect(
      resolveActiveSection("settings", {
        isOwner: false,
        workspaceKind: "knowledge_region",
      }),
    ).toBe("workspace");

    const normal = availableWorkspaceSections({ isOwner: true });
    expect(normal).toEqual([
      "workspace",
      "dags",
      "map_types",
      "unsys_models",
      "context",
      "settings",
    ]);
    expect(defaultWorkspaceSection("standard")).toBe("workspace");
    expect(resolveActiveSection("settings", { isOwner: false })).toBe("workspace");

    const krTabs = availableSettingsSubviews("knowledge_region");
    expect([...krTabs]).toEqual(["general", "aycl", "integrations"]);
    expect(defaultSettingsSubview("knowledge_region")).toBe("general");
    expect(resolveSettingsSubview("general", "knowledge_region")).toBe("general");
    expect(resolveSettingsSubview("guest-links", "knowledge_region")).toBe("general");
    expect(resolveSettingsSubview("knowledge-portal", "knowledge_region")).toBe("general");
    expect([...krTabs]).not.toContain("guest-links");
    expect([...krTabs]).not.toContain("knowledge-portal");
    expect(settingsSubviewLabel("integrations", "knowledge_region")).toBe("Integrations");
    expect(settingsSubviewLabel("regions", "knowledge_region")).toBe("Knowledge Regions");

    const fullTabs = availableSettingsSubviews("standard");
    expect(fullTabs).toContain("general");
    expect(fullTabs).toContain("aycl");
    expect([...fullTabs]).not.toContain("guest-links");
    expect([...fullTabs]).not.toContain("knowledge-portal");
    expect([...fullTabs]).not.toContain("regions");
    expect(resolveSettingsSubview("guest-links", "standard")).toBe("general");
    expect(resolveSettingsSubview("knowledge-portal", "standard")).toBe("general");
    expect(defaultSettingsSubview("standard")).toBe("general");

    writeScratch(
      "knowledge-region-shell.log",
      [
        `kr_owner_sections=${JSON.stringify(owner)}`,
        `kr_owner_has_workspace=${owner.includes("workspace")}`,
        `kr_default=${defaultWorkspaceSection("knowledge_region")}`,
        `kr_hidden_workspace=${resolveActiveSection("workspace", { isOwner: true, workspaceKind: "knowledge_region" })}`,
        `kr_non_owner=${JSON.stringify(nonOwner)}`,
        `kr_settings=${JSON.stringify([...krTabs])}`,
        `kr_settings_default=${defaultSettingsSubview("knowledge_region")}`,
        `kr_integration_label=${settingsSubviewLabel("integrations", "knowledge_region")}`,
        `normal_owner_sections=${JSON.stringify(normal)}`,
        `normal_settings_has_guest_links=${([...fullTabs] as string[]).includes("guest-links")}`,
        `normal_settings_has_portal=${([...fullTabs] as string[]).includes("knowledge-portal")}`,
        `guest_links_resolves=${resolveSettingsSubview("guest-links", "standard")}`,
      ].join("\n") + "\n",
    );
  });
});

describe("Knowledge Region knowledge-link deny", () => {
  it("allows mint on leftover kinds the same as Learning", async () => {
    expect(workspaceAllowsKnowledgeLinkMint("knowledge_region")).toBe(true);
    expect(workspaceAllowsKnowledgeLinkMint("calibration")).toBe(true);
    expect(workspaceAllowsKnowledgeLinkMint("standard")).toBe(true);
    expect(workspaceAllowsKnowledgeLinkMint(undefined)).toBe(true);
    expect(assertWorkspaceAllowsKnowledgeLinkMint("knowledge_region")).toEqual({ ok: true });
    expect(assertWorkspaceAllowsKnowledgeLinkMint("standard")).toEqual({ ok: true });
    expect(isKnowledgeRegionWorkspace(parseWorkspaceKind("knowledge_region"))).toBe(false);
  });
});

describe("Knowledge Region zero-block PoW surfaces", () => {
  it("encodes a unit flow vector without requiring blocks", async () => {
    expect(normalizeGoalText("  Ship PoW  ")).toBe("Ship PoW");
    const encoded = await encodeTextsToFlowVector(["kr-ws", "tool cli", "screen", "external pow"]);
    expect(encoded.every((x) => Number.isFinite(x))).toBe(true);
    expect(Math.abs(l2Norm(encoded) - 1)).toBeLessThan(1e-6);
    expect(encoded).toHaveLength(FLOW_EMBEDDING_DIM);
  });
});

describe("Knowledge Region embeddings import overlay", () => {
  it("imports owned-foreign regions into the shipped projector and excludes non-owned", async () => {
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
