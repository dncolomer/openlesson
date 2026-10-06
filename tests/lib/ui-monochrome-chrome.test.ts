/**
 * Product chrome monochrome contract: no blue/cyan/sky/indigo/purple/violet/yellow/amber
 * Tailwind utilities on high-traffic shell panels (white outline aesthetic).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readKnowledgePanelSurface } from "../helpers/surface-source";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

/**
 * Forbidden product-chrome accent utilities (not data-vis hex palettes).
 * Includes directional borders (border-t-cyan-500 spinner tops, etc.).
 */
const FORBIDDEN =
  /\b(bg|text|border|border-[trblxyse]|ring|from|to|via|fill|stroke|outline|placeholder|divide)-(cyan|blue|sky|indigo|violet|purple|fuchsia|yellow|amber)-/;

const SHELL_PANELS = [
  "components/CustomVerificationModelsPanel.tsx",
  "components/KnowledgeConfigTrajectoryPanel.tsx",
  "components/ui/ConfirmDialog.tsx",
  "components/ui/DialogFrame.tsx",
  "components/StrengthsGapsPanel.tsx",
  "components/WorkspacePerformancePanel.tsx",
  "components/ModelLoadingModal.tsx",
];

const REMOVED_SHELL_PANELS = [
  "components/WorkspaceGuestLinksPanel.tsx",
  "components/WorkspaceModeSelect.tsx",
  "components/ProbesPanel.tsx",
  "components/MobileProbesTab.tsx",
];

describe("UI monochrome chrome (white outline aesthetic)", () => {
  it("shell panels have no forbidden blue/cyan/purple/yellow Tailwind chrome", () => {
    for (const rel of REMOVED_SHELL_PANELS) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(false);
    }
    for (const rel of SHELL_PANELS) {
      const src = read(rel);
      const hit = src.match(FORBIDDEN);
      expect(hit, `${rel} still has accent utility: ${hit?.[0] ?? ""}`).toBeNull();
    }
  });

  it("loading modal uses white/neutral tops; probe panels are absent", () => {
    const modal = read("components/ModelLoadingModal.tsx");
    expect(modal).toMatch(/animate-spin/);
    expect(modal).not.toMatch(/border-t-(cyan|purple|blue|amber|yellow|violet)-/);
    expect(modal).toMatch(/border-t-white|border-t-neutral-/);

    expect(existsSync(join(ROOT, "components/ProbesPanel.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/MobileProbesTab.tsx"))).toBe(false);
  });

  it("TAPBench landing CTAs are white/black monochrome; guest links panel is absent", () => {
    expect(existsSync(join(ROOT, "components/WorkspaceGuestLinksPanel.tsx"))).toBe(false);

    const landing = read("components/TapbenchLanding.tsx");
    expect(landing).toMatch(/bg-white|text-white/);
    expect(landing).not.toMatch(/bg-cyan-|bg-blue-/);
  });

  it("LWM generate / score chrome stays neutral-white outline", () => {
    const lwm = readKnowledgePanelSurface();
    expect(lwm).toContain("data-lwm-generate-snapshot");
    expect(lwm).toMatch(/bg-white/);
    expect(lwm).not.toMatch(/bg-cyan-|text-blue-400|border-amber-/);
    // Trajectory chrome hex accents remapped off pure cyan
    expect(lwm).not.toContain("#22d3ee");
  });
});
