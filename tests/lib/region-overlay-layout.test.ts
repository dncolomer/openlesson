/**
 * Embeddings region-overlay: multi-select list + distance cards must not share
 * the same scroll/overflow space (overlap / unusable checklist).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");
const PANEL = join(ROOT, "components/KnowledgeConfigTrajectoryPanel.tsx");

function readPanel(): string {
  return readFileSync(PANEL, "utf8");
}

/** Slice the region-overlay-picker block for layout assertions. */
function overlayPickerBlock(src: string): string {
  const start = src.indexOf("data-region-overlay-picker");
  expect(start).toBeGreaterThanOrEqual(0);
  // Approximate block: from picker marker to end of regions rail / embeddings section
  const endCandidates = [
    src.indexOf("data-embeddings-regions-rail", start) > -1
      ? src.indexOf("</aside>", start)
      : -1,
    src.indexOf("{/* Learning World Model", start),
    src.indexOf('data-section="lwm"', start),
  ].filter((i) => i > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : start + 8000;
  return src.slice(start, Math.min(end + 200, start + 12000));
}

describe("Embeddings region overlay non-overlap layout", () => {
  it("list body scrolls; distances panel is shrink-0 with own max-height scroll", () => {
    const block = overlayPickerBlock(readPanel());

    // Picker is a flex column that clips children instead of stacking overflow
    expect(block).toMatch(/data-region-overlay-picker[\s\S]{0,200}flex min-h-0 flex-1 flex-col/);
    expect(block).toMatch(/data-region-overlay-picker[\s\S]{0,280}overflow-hidden/);

    // List container is the flex-1 scroll pane
    expect(block).toContain("data-region-overlay-body");
    expect(block).toMatch(
      /data-region-overlay-body[\s\S]{0,120}min-h-0 flex-1 overflow-y-auto/,
    );
    expect(block).toContain("data-region-overlay-list");
    expect(block).toContain("data-region-overlay-toggle");

    // Distance cards: reserved bottom strip, not floating over the list
    expect(block).toContain("data-region-overlay-distances");
    // className may appear before the data- attribute
    expect(block).toMatch(
      /(?:shrink-0[\s\S]{0,120}data-region-overlay-distances|data-region-overlay-distances[\s\S]{0,200}shrink-0)/,
    );
    expect(block).toMatch(/max-h-\[(?:40|42|45)%\]/);
    // Inner list of distance cards scrolls when many selected
    expect(block).toContain("data-knowledge-distance-list");
    expect(block).toMatch(
      /(?:overflow-y-auto[\s\S]{0,80}data-knowledge-distance-list|data-knowledge-distance-list[\s\S]{0,120}overflow-y-auto)/,
    );
    expect(block).toContain("data-region-overlay-count");
    expect(block).toContain("data-knowledge-distance");
  });

  it("distances panel appears after list body in DOM order (siblings, not stacked absolute)", () => {
    const block = overlayPickerBlock(readPanel());
    const listIdx = block.indexOf("data-region-overlay-list");
    const distIdx = block.indexOf("data-region-overlay-distances");
    expect(listIdx).toBeGreaterThanOrEqual(0);
    expect(distIdx).toBeGreaterThan(listIdx);
    // No absolute positioning on distance panel that would cover the list
    const distSlice = block.slice(distIdx, distIdx + 350);
    expect(distSlice).not.toMatch(/absolute\s+(inset|bottom|top)/);
  });

  it("regions rail keeps picker usable (overflow-hidden; list + distances non-overlap)", () => {
    const src = readPanel();
    const rail = src.indexOf("data-embeddings-regions-rail");
    expect(rail).toBeGreaterThanOrEqual(0);
    const railClasses = src.slice(rail, rail + 280);
    expect(railClasses).toMatch(/overflow-hidden/);
    // Region picker sits on the right of the projection canvas
    const projectionIdx = src.indexOf("data-embeddings-projection");
    const pickerIdx = src.indexOf("data-region-overlay-picker");
    expect(projectionIdx).toBeGreaterThanOrEqual(0);
    expect(pickerIdx).toBeGreaterThan(projectionIdx);
    expect(pickerIdx).toBeGreaterThan(rail);
    // Capabilities still present
    expect(src).toContain("data-region-overlay-refresh");
    expect(src).toContain("toggleRegionOverlay");
    expect(src).toContain("knowledge_distance");
    expect(src).toContain("regionOverlays");
  });

  it("regions rail is to the right of the projection surface in DOM order", () => {
    const src = readPanel();
    const sidebarIdx = src.indexOf("data-embeddings-sidebar");
    const projectionIdx = src.indexOf("data-embeddings-projection");
    const railIdx = src.indexOf("data-embeddings-regions-rail");
    expect(sidebarIdx).toBeGreaterThanOrEqual(0);
    expect(projectionIdx).toBeGreaterThan(sidebarIdx);
    expect(railIdx).toBeGreaterThan(projectionIdx);
    expect(src).toContain('data-embeddings-layout="left-canvas-right-regions"');
  });
});
