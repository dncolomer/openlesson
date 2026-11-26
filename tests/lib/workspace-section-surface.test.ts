import { describe, expect, it } from "vitest";
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
import {
  availableSettingsSubviews,
  resolveSettingsSubview,
  settingsSubTabsForKind,
} from "@/lib/workspace-settings-tabs";

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
  it("splits settings by product and omits Knowledge Portal", () => {
    const normal = availableSettingsSubviews("standard");
    expect([...normal]).toEqual(["general", "aycl", "integrations"]);
    expect(resolveSettingsSubview("knowledge-portal", "standard")).toBe("general");
    expect(resolveSettingsSubview("regions", "standard")).toBe("general");
    expect(resolveSettingsSubview("data-studio", "standard")).toBe("general");

    const region = availableSettingsSubviews("knowledge_region");
    expect([...region]).toEqual(["general", "aycl", "integrations"]);
    expect([...region]).toContain("aycl");
    expect(resolveSettingsSubview("aycl", "knowledge_region")).toBe("aycl");
    expect(resolveSettingsSubview("knowledge-portal", "knowledge_region")).toBe("general");

    const tabs = settingsSubTabsForKind("standard", (key) =>
      key === "planView.knowledgePortalSettingsTab" ? "Knowledge Portal" : key,
    );
    expect(tabs.map((tab) => tab.id)).toEqual(["general", "aycl", "integrations"]);
    expect(tabs.map((tab) => tab.label)).not.toContain("Knowledge Portal");
    expect(tabs.map((tab) => tab.label)).not.toContain("Knowledge Links");
    const regionTabs = settingsSubTabsForKind("knowledge_region", () => "Knowledge Links");
    expect(regionTabs.map((tab) => tab.id)).not.toContain("knowledge-portal");
    expect(regionTabs.map((tab) => tab.label)).not.toContain("Knowledge Links");
  });
});
