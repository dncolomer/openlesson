/**
 * Unmounted LWM view is gone; Knowledge ships embeddings + snapshot modal.
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readKnowledgePanelSurface } from "../helpers/surface-source";

const ROOT = join(__dirname, "../..");

describe("LWM architecture (integrated detail)", () => {
  it("unmounted LWM view is gone; embeddings + snapshot modal remain", () => {
    expect(existsSync(join(ROOT, "components/knowledge-panel/lwm-view.tsx"))).toBe(false);
    const src = readKnowledgePanelSurface();
    expect(src).toContain('data-section="embeddings-projections"');
    expect(src).toContain("data-lwm-snapshot-modal");
    expect(src).toContain("data-lwm-goal-selection");
    expect(src).toContain("data-lwm-snapshot-progress");
    expect(src).toContain("generateSnapshot");
    expect(src).toContain("generateSnapshotAll");
    expect(src).not.toContain('data-lwm-layout="profile-zones"');
  });
});
