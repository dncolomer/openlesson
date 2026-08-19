import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  KNOWLEDGE_BODY_LAYOUT_CLASS,
  SECTION_PANEL_BODY_CLASS,
  SECTION_SURFACE_GRADIENT_CLASS,
  SECTION_SURFACE_IMAGE_CLASS,
  SECTION_SURFACE_ROOT_CLASS,
  SECTION_SURFACE_SCRIM_CLASS,
  SECTION_TAB_CONTENT_CLASS,
  SETTING_BODY_LAYOUT_CLASS,
  SETTING_INNER_LAYOUT_CLASS,
  resolveSectionIdentityDisplay,
  resolveSectionSurfaceImage,
} from "@/lib/workspace-section-surface";
import { aestheticImageForId } from "@/lib/aesthetics";
import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";

const REPO_ROOT = path.resolve(__dirname, "../..");

describe("resolveSectionSurfaceImage", () => {
  it("uses the shipped aesthetics stable picker for a workspace id", () => {
    const id = "workspace-abc-123";
    expect(resolveSectionSurfaceImage(id)).toBe(aestheticImageForId(id));
    expect(resolveSectionSurfaceImage(id)).toMatch(/^\/aesthetics\//);
  });

  it("is stable across calls", () => {
    expect(resolveSectionSurfaceImage("same-id")).toBe(resolveSectionSurfaceImage("same-id"));
  });
});

describe("resolveSectionIdentityDisplay", () => {
  it("surfaces real title, description, and owner for Knowledge", () => {
    const display = resolveSectionIdentityDisplay(
      {
        title: "Sales Copilot",
        topic: "B2B discovery",
        description: "Close gaps on ICP clarity",
        notes: "Focus on discovery calls",
        workspaceId: "ws-1",
        isOwner: true,
      },
      "knowledge",
    );
    expect(display.eyebrow).toBe("Knowledge");
    expect(display.title).toBe("Sales Copilot");
    expect(display.subtitle).toBe("Close gaps on ICP clarity");
    expect(display.topic).toBe("B2B discovery");
    expect(display.showOwnerBadge).toBe(true);
    expect(display.notesPreview).toBeNull();
  });

  it("includes notes preview for Setting identity", () => {
    const display = resolveSectionIdentityDisplay(
      {
        title: "Ops",
        topic: "Ops",
        description: null,
        notes: "A".repeat(200),
        workspaceId: "ws-2",
        isOwner: false,
      },
      "settings",
    );
    expect(display.eyebrow).toBe("Settings");
    expect(display.showOwnerBadge).toBe(false);
    expect(display.notesPreview).toBeTruthy();
    expect(display.notesPreview!.endsWith("…")).toBe(true);
    expect(display.notesPreview!.length).toBeLessThanOrEqual(160);
  });
});

describe("layout class contracts", () => {
  it("Knowledge and Settings share the same compact shell body", () => {
    expect(KNOWLEDGE_BODY_LAYOUT_CLASS).toBe(SECTION_PANEL_BODY_CLASS);
    expect(SETTING_BODY_LAYOUT_CLASS).toBe(SECTION_PANEL_BODY_CLASS);
    expect(SECTION_PANEL_BODY_CLASS).toContain("max-w-none");
    expect(SECTION_PANEL_BODY_CLASS).toContain("flex-1");
    expect(SECTION_PANEL_BODY_CLASS).toContain("overflow-hidden");
    expect(SECTION_PANEL_BODY_CLASS).not.toContain("max-w-xl");
  });

  it("tab content is compact full-width (Knowledge density)", () => {
    expect(SECTION_TAB_CONTENT_CLASS).toContain("p-3");
    expect(SECTION_TAB_CONTENT_CLASS).toContain("sm:p-4");
    expect(SECTION_TAB_CONTENT_CLASS).not.toContain("lg:p-8");
    expect(SECTION_TAB_CONTENT_CLASS).not.toContain("sm:p-6");
    expect(SECTION_TAB_CONTENT_CLASS).toContain("max-w-none");
    expect(SETTING_INNER_LAYOUT_CLASS).toContain("max-w-none");
    expect(SETTING_INNER_LAYOUT_CLASS).toContain("w-full");
    expect(SETTING_INNER_LAYOUT_CLASS).not.toContain("max-w-3xl");
    expect(SETTING_INNER_LAYOUT_CLASS).not.toContain("mx-auto");
    expect(SETTING_INNER_LAYOUT_CLASS).toContain("space-y-");
  });

  it("section surface includes aesthetic image + overlay classes", () => {
    expect(SECTION_SURFACE_ROOT_CLASS).toContain("relative");
    expect(SECTION_SURFACE_IMAGE_CLASS).toContain("object-cover");
    expect(SECTION_SURFACE_SCRIM_CLASS).toContain("bg-black");
    expect(SECTION_SURFACE_GRADIENT_CLASS).toContain("bg-gradient-to-b");
    expect(KNOWLEDGE_BODY_LAYOUT_CLASS).toContain("flex-1");
  });
});

describe("shipped Knowledge / Setting aesthetic wiring", () => {
  const view = readWorkspaceViewSurface();
  const aycl = fs.readFileSync(path.join(REPO_ROOT, "components/AyclWorkspaceView.tsx"), "utf8");
  const surface = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspaceSectionSurface.tsx"),
    "utf8",
  );
  const integration = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspaceIntegrationPanel.tsx"),
    "utf8",
  );
  const knowledge = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspacePerformancePanel.tsx"),
    "utf8",
  );
  const subTabs = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspaceSectionSubTabs.tsx"),
    "utf8",
  );

  it("hosts Knowledge and Setting in WorkspaceSectionSurface with aesthetic imageSrc", () => {
    expect(view).toContain("WorkspaceSectionSurface");
    expect(view).toContain('kind="knowledge"');
    expect(view).toContain('kind="settings"');
    expect(view).toContain("imageSrc={workspaceImage}");
    expect(view).toContain("<WorkspacePerformancePanel");
    expect(view).toContain("<WorkspaceIntegrationPanel");

    // AYCL shell is a thin WorkspaceView wrapper (surfaces live inside WorkspaceView).
    expect(aycl).toContain("WorkspaceView");
    expect(aycl).toContain("ayclToken={accessToken}");
  });

  it("section surface renders aesthetic image + overlays without identity name bar", () => {
    expect(surface).toContain("SECTION_SURFACE_IMAGE_CLASS");
    expect(surface).toContain("SECTION_SURFACE_SCRIM_CLASS");
    expect(surface).toContain("SECTION_SURFACE_GRADIENT_CLASS");
    expect(surface).toContain("data-workspace-section-surface");
    // Shared shell body for Knowledge and Settings (no kind-specific padding).
    expect(surface).toContain("SECTION_PANEL_BODY_CLASS");
    expect(surface).not.toContain("SETTING_BODY_LAYOUT_CLASS");
    expect(surface).not.toContain("KNOWLEDGE_BODY_LAYOUT_CLASS");
    // No workspace name / labels bar on Knowledge or Settings
    expect(surface).not.toContain("data-section-identity");
    expect(surface).not.toContain("resolveSectionIdentityDisplay");
    expect(surface).not.toContain("SECTION_SURFACE_HEADER_CLASS");
  });

  it("Knowledge and Settings share WorkspaceSectionSubTabs sized like section nav + tab content", () => {
    expect(subTabs).toContain("WorkspaceSectionSubTabs");
    expect(subTabs).toContain('role="tablist"');
    // Match WorkspaceSectionNav bar tab height/size (not the old compact strip).
    expect(subTabs).toContain("text-sm font-medium");
    expect(subTabs).toContain("px-3 py-2.5");
    expect(subTabs).toContain("sm:px-5");
    expect(subTabs).toContain("h-0.5 rounded-full");

    expect(knowledge).toContain("WorkspaceSectionSubTabs");
    expect(knowledge).toContain("SECTION_TAB_CONTENT_CLASS");
    expect(knowledge).toContain('dataAttr="knowledge"');
    expect(knowledge).toContain("data-knowledge-tab-body");

    expect(integration).toContain("WorkspaceSectionSubTabs");
    expect(integration).toContain("SECTION_TAB_CONTENT_CLASS");
    expect(integration).toContain('dataAttr="settings"');
    expect(integration).toContain('data-settings-layout="tabs"');
    expect(subTabs).toContain("data-settings-tablist");
    expect(subTabs).toContain("data-settings-tab");
    expect(subTabs).toContain('role="tablist"');
    expect(integration).toContain('id: "general"');
    expect(integration).toContain('id: "regions"');
    expect(integration).toContain('id: "knowledge-portal"');
    expect(integration).toContain('id: "guest-links"');
    expect(integration).toContain('id: "data-studio"');
    expect(integration).toContain('id: "integrations"');
    // Settings tab label for guest-links subview is Knowledge Links (i18n).
    expect(integration).toContain('t("planView.performanceSubTabTap")');
    const en = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, "messages/en.json"), "utf8"),
    ) as { planView?: Record<string, string> };
    expect(en.planView?.performanceSubTabTap).toBe("Knowledge Links");
    expect(en.planView?.performanceSubTabTap).not.toMatch(/Guest Links/i);
    // Knowledge Portal tab is adjacent to Knowledge Regions in declared order.
    const regionsIdx = integration.indexOf('id: "regions"');
    const portalIdx = integration.indexOf('id: "knowledge-portal"');
    const guestIdx = integration.indexOf('id: "guest-links"');
    const dataStudioIdx = integration.indexOf('id: "data-studio"');
    expect(regionsIdx).toBeGreaterThan(-1);
    expect(portalIdx).toBeGreaterThan(regionsIdx);
    expect(guestIdx).toBeGreaterThan(portalIdx);
    expect(dataStudioIdx).toBeGreaterThan(guestIdx);
    expect(integration).toContain('data-settings-tab-panel="general"');
    expect(integration).toContain('data-settings-tab-panel="aycl"');
    expect(integration).toContain('data-settings-tab-panel="regions"');
    expect(integration).toContain('data-settings-tab-panel="knowledge-portal"');
    expect(integration).toContain('data-settings-tab-panel="guest-links"');
    expect(integration).toContain('data-settings-tab-panel="data-studio"');
    expect(integration).toContain('data-settings-tab-panel="integrations"');
    // Active-tab conditionals (only one body shown at a time).
    expect(integration).toContain('activeSubview === "general"');
    expect(integration).toContain('activeSubview === "regions"');
    expect(integration).toContain('activeSubview === "knowledge-portal"');
    expect(integration).toContain('activeSubview === "guest-links"');
    expect(integration).toContain('activeSubview === "data-studio"');
    expect(integration).toContain('activeSubview === "integrations"');
    // Major capabilities still wired under tabs.
    expect(integration).toContain('data-settings-section="custom-knowledge-regions"');
    expect(integration).toContain('data-settings-section="knowledge-portal"');
    expect(integration).toContain('data-settings-section="guest-tap-ile"');
    expect(integration).toContain('data-settings-section="data-studio"');
    expect(integration).toContain('data-settings-section="skill"');
    expect(integration).toContain('data-settings-section="mcp"');
    expect(integration).toContain("WorkspaceIdentitySettings");
    expect(integration).toContain("WorkspaceAccessSettings");
    expect(integration).toContain("CustomVerificationModelsPanel");
    expect(integration).toContain("WorkspaceGuestLinksPanel");
    expect(integration).toContain("WorkspaceKnowledgePortalPanel");
    expect(integration).toContain("WorkspaceDataStudioPanel");
    expect(integration).not.toContain('data-settings-layout="linear"');
    expect(integration).not.toContain('data-settings-section="generate"');
    expect(integration).not.toContain("data-settings-workspace-context");
    expect(integration).not.toContain("SETTING_DESKTOP_GRID_CLASS");
    expect(integration).not.toContain("resolveSectionIdentityDisplay");
    // No heavy nested section cards with large padding (compact Knowledge density).
    expect(integration).not.toContain("p-5 backdrop-blur-md sm:p-6");
    expect(integration).not.toContain("lg:p-8");
    expect(integration).toContain("workspaceId");
    expect(integration).toContain("planNotes");
    expect(integration).toContain('layout="stack"');
    expect(integration).not.toMatch(/max-w-xl/);
    // Workspace-tailored skill.md download still wired
    expect(integration).toContain("/api/workspace/integration-skill");
    expect(integration).not.toContain("/api/workspace/proof-of-work-schema");
  });
});
