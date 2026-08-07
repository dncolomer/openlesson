/**
 * Product chrome monochrome contract: no blue/cyan/sky/indigo/purple/violet/yellow/amber
 * Tailwind utilities on high-traffic shell panels (white outline aesthetic).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

/** Forbidden product-chrome accent utilities (not data-vis hex palettes). */
const FORBIDDEN =
  /\b(bg|text|border|ring|from|to|via|fill|stroke|outline)-(cyan|blue|sky|indigo|violet|purple|fuchsia|yellow|amber)-/;

const SHELL_PANELS = [
  "components/WorkspaceGuestLinksPanel.tsx",
  "components/WorkspaceTapbenchLinksPanel.tsx",
  "components/CustomVerificationModelsPanel.tsx",
  "components/KnowledgeConfigTrajectoryPanel.tsx",
  "components/WorkspaceModeSelect.tsx",
  "components/ui/ConfirmDialog.tsx",
  "components/StrengthsGapsPanel.tsx",
  "components/WorkspacePerformancePanel.tsx",
];

describe("UI monochrome chrome (white outline aesthetic)", () => {
  it("shell panels have no forbidden blue/cyan/purple/yellow Tailwind chrome", () => {
    for (const rel of SHELL_PANELS) {
      const src = read(rel);
      const hit = src.match(FORBIDDEN);
      expect(hit, `${rel} still has accent utility: ${hit?.[0] ?? ""}`).toBeNull();
    }
  });

  it("Guest Links + TAPBench primary CTAs are white/black monochrome", () => {
    const guest = read("components/WorkspaceGuestLinksPanel.tsx");
    expect(guest).toMatch(/bg-white[\s\S]{0,80}text-black|text-black[\s\S]{0,80}bg-white/);
    expect(guest).toContain("data-guest-links-create-submit");
    expect(guest).not.toMatch(/bg-cyan-|bg-blue-/);

    const tb = read("components/WorkspaceTapbenchLinksPanel.tsx");
    expect(tb).toContain("PRIMARY_CTA_CLASS");
    expect(tb).toMatch(/bg-white/);
    expect(tb).toMatch(/text-black/);
    expect(tb).not.toMatch(/bg-cyan-|bg-blue-/);
  });

  it("LWM generate / score chrome stays neutral-white outline", () => {
    const lwm = read("components/KnowledgeConfigTrajectoryPanel.tsx");
    expect(lwm).toContain("data-lwm-generate-snapshot");
    expect(lwm).toMatch(/bg-white/);
    expect(lwm).not.toMatch(/bg-cyan-|text-blue-400|border-amber-/);
    // Trajectory chrome hex accents remapped off pure cyan
    expect(lwm).not.toContain("#22d3ee");
  });
});
