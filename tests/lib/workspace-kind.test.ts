import { describe, expect, it } from "vitest";
import {
  noMapWorkspaceDashboardHref,
  parseWorkspaceKind,
} from "@/lib/workspace-kind";

describe("parseWorkspaceKind", () => {
  it("maps stored ids and aliases onto the three durable kinds", () => {
    expect(parseWorkspaceKind("standard")).toBe("standard");
    expect(parseWorkspaceKind("knowledge_region")).toBe("knowledge_region");
    expect(parseWorkspaceKind("knowledge-region")).toBe("knowledge_region");
    expect(parseWorkspaceKind("knowledgeRegion")).toBe("knowledge_region");
    expect(parseWorkspaceKind("calibration")).toBe("calibration");
    expect(parseWorkspaceKind("calibrate")).toBe("calibration");
    expect(parseWorkspaceKind("calibration_workspace")).toBe("calibration");
    expect(parseWorkspaceKind(undefined)).toBe("standard");
    expect(parseWorkspaceKind("learning")).toBe("standard");
  });
});

describe("noMapWorkspaceDashboardHref", () => {
  it("sends knowledge_region and calibration to dashboard Flows", () => {
    expect(noMapWorkspaceDashboardHref("knowledge_region")).toBe(
      "/dashboard?tab=verification",
    );
    expect(noMapWorkspaceDashboardHref("knowledge-region")).toBe(
      "/dashboard?tab=verification",
    );
    expect(noMapWorkspaceDashboardHref("calibration")).toBe(
      "/dashboard?tab=calibration",
    );
    expect(noMapWorkspaceDashboardHref("calibrate")).toBe(
      "/dashboard?tab=calibration",
    );
    expect(noMapWorkspaceDashboardHref("standard")).toBeNull();
    expect(noMapWorkspaceDashboardHref(undefined)).toBeNull();
  });
});
