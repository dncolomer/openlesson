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
  "components/WorkspaceGuestLinksPanel.tsx",
  "components/CustomVerificationModelsPanel.tsx",
  "components/KnowledgeConfigTrajectoryPanel.tsx",
  "components/WorkspaceModeSelect.tsx",
  "components/ui/ConfirmDialog.tsx",
  "components/StrengthsGapsPanel.tsx",
  "components/WorkspacePerformancePanel.tsx",
  "components/ModelLoadingModal.tsx",
  "components/ProbesPanel.tsx",
  "components/MobileProbesTab.tsx",
];

describe("UI monochrome chrome (white outline aesthetic)", () => {
  it("shell panels have no forbidden blue/cyan/purple/yellow Tailwind chrome", () => {
    for (const rel of SHELL_PANELS) {
      const src = read(rel);
      const hit = src.match(FORBIDDEN);
      expect(hit, `${rel} still has accent utility: ${hit?.[0] ?? ""}`).toBeNull();
    }
  });

  it("loading spinners use white/neutral tops, not cyan/purple/amber", () => {
    const modal = read("components/ModelLoadingModal.tsx");
    expect(modal).toMatch(/animate-spin/);
    expect(modal).not.toMatch(/border-t-(cyan|purple|blue|amber|yellow|violet)-/);
    expect(modal).toMatch(/border-t-white|border-t-neutral-/);

    const probes = read("components/ProbesPanel.tsx");
    expect(probes).not.toMatch(/border-t-(cyan|purple|blue|amber|yellow|violet)-/);
    expect(probes).toMatch(/border-t-white|border-t-neutral-/);

    const mobile = read("components/MobileProbesTab.tsx");
    expect(mobile).not.toMatch(/border-t-(cyan|purple|blue|amber|yellow|violet)-/);
    expect(mobile).toMatch(/border-t-white|border-t-neutral-/);
  });

  it("Guest Links + TAPBench primary CTAs are white/black monochrome", () => {
    const guest = read("components/WorkspaceGuestLinksPanel.tsx");
    expect(guest).toMatch(/bg-white[\s\S]{0,80}text-black|text-black[\s\S]{0,80}bg-white/);
    expect(guest).toContain("data-guest-links-create-submit");
    expect(guest).not.toMatch(/bg-cyan-|bg-blue-/);

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
