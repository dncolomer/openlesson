/**
 * LWM tab friendliness: hierarchy + progressive disclosure without dropping capabilities.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");
const LWM = join(ROOT, "components/KnowledgeConfigTrajectoryPanel.tsx");

function readLwm(): string {
  return readFileSync(LWM, "utf8");
}

/** Extract the LWM section for order checks. */
function lwmSection(src: string): string {
  const i = src.indexOf('data-lwm-layout="hero-first"');
  if (i < 0) return src;
  return src.slice(i, i + 30000);
}

describe("LWM UI hierarchy (friendly layout)", () => {
  it("uses hero-first layout and primary / filters / history sections", () => {
    const src = readLwm();
    expect(src).toContain('data-lwm-layout="hero-first"');
    expect(src).toContain("data-lwm-primary");
    expect(src).toContain("data-lwm-filters");
    expect(src).toContain("data-lwm-history-section");
    expect(src).toContain("data-lwm-history-toggle");
    // Report and history start collapsed (progressive disclosure)
    expect(src).toMatch(/useState\(false\).*lwmReportOpen|lwmReportOpen.*useState\(false\)/);
    expect(src).toContain("const [lwmReportOpen, setLwmReportOpen] = useState(false)");
    expect(src).toContain("const [lwmHistoryOpen, setLwmHistoryOpen] = useState(false)");
  });

  it("primary block appears before history/timeline chrome in source order", () => {
    const section = lwmSection(readLwm());
    const primary = section.indexOf("data-lwm-primary");
    const filters = section.indexOf("data-lwm-filters");
    const history = section.indexOf("data-lwm-history-section");
    const timeline = section.indexOf("data-lwm-timeline");
    expect(primary).toBeGreaterThanOrEqual(0);
    expect(filters).toBeGreaterThan(primary);
    expect(history).toBeGreaterThan(filters);
    expect(timeline).toBeGreaterThan(history);
  });

  it("keeps all core capabilities and real snapshot endpoints", () => {
    const src = readLwm();
    // Single-subject generate
    expect(src).toContain("data-lwm-generate-snapshot");
    expect(src).toContain("Generate new snapshot");
    expect(src).toContain("/api/workspace/performance-report");
    // Multi-user generate + progress
    expect(src).toContain("data-lwm-generate-snapshot-all");
    expect(src).toContain("data-lwm-snapshot-all-progress");
    expect(src).toContain("data-lwm-snapshot-all-bar");
    expect(src).toContain("data-lwm-snapshot-all-status");
    expect(src).toContain("/snapshot-all");
    expect(src).toContain("stream: true");
    // Scores + timeline + trends + report
    expect(src).toContain("data-lwm-skill-score");
    expect(src).toContain("data-lwm-ghc-score");
    expect(src).toContain("data-lwm-skill-card");
    expect(src).toContain("data-lwm-timeline");
    expect(src).toContain("data-lwm-score-trend");
    expect(src).toContain("data-lwm-report-toggle");
    expect(src).toContain("data-lwm-selected-snapshot-report");
    expect(src).toContain("data-lwm-date-from");
    expect(src).toContain("data-lwm-date-to");
    expect(src).toContain("data-lwm-date-last-7d");
    expect(src).toContain("defaultLwmTimelineDateWindow");
    expect(src).toContain("loadSnapshotEligibility");
  });
});
