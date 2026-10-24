/**
 * Structural inventory: report must list every section key from shipped
 * registries and the drawer labels (no invented names; no silent drift).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blockMapToolLabel } from "@/lib/block-map-tools";
import {
  WORKSPACE_SECTION_KEYS,
  availableWorkspaceSections,
} from "@/lib/workspace-sections";

const SCRATCH =
  process.env.GROK_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-affd94f6d050/implementer";

const REPORT_REL = "docs/course-authoring-tools-report.md";

function readReport(): string {
  return readFileSync(join(process.cwd(), REPORT_REL), "utf8");
}

describe("course authoring tools report", () => {
  it("exists with required section headings", () => {
    const report = readReport();
    expect(report.length).toBeGreaterThan(500);

    const requiredHeadings = [
      "Top-level workspace sections",
      "Right-pane surfaces",
      "Context section",
      "Simulation section",
      "Settings section",
      "Grid / map-ground operations",
    ];
    for (const h of requiredHeadings) {
      expect(report).toContain(h);
    }

    // Author surfaces called out in plan AC
    expect(report).toMatch(/stretch|resize/i);
    expect(report).toMatch(/validation/i);
    expect(report).toMatch(/Block Simulation/);
    expect(report).toMatch(/lasso/i);
  });

  it("lists every section key from shipped registries and drawer labels", () => {
    const report = readReport();

    expect(blockMapToolLabel("merge").length).toBeGreaterThan(0);
    expect(blockMapToolLabel("split").length).toBeGreaterThan(0);
    expect(blockMapToolLabel("clone").length).toBeGreaterThan(0);

    for (const key of WORKSPACE_SECTION_KEYS) {
      expect(report).toContain(`\`${key}\``);
    }

    const owner = availableWorkspaceSections({ isOwner: true });
    expect(owner).toEqual([
      "workspace",
      "dags",
      "map_types",
      "unsys_models",
      "context",
      "settings",
    ]);

    expect(report).toContain("`move`");
    expect(report).toMatch(/lasso_circle|lasso_freehand/);
    expect(report).toContain("generate_shape");
  });

  it("writes verification evidence to scratch", () => {
    mkdirSync(SCRATCH, { recursive: true });
    const report = readReport();
    const sectionsOk = WORKSPACE_SECTION_KEYS.every((k) =>
      report.includes(`\`${k}\``),
    );
    const headings = [
      "Top-level workspace sections",
      "Right-pane surfaces",
      "Context section",
      "Simulation section",
      "Settings section",
      "Grid / map-ground operations",
    ];
    const headingsOk = headings.every((h) => report.includes(h));

    writeFileSync(
      join(SCRATCH, "course-authoring-tools-report-check.log"),
      [
        "course-authoring-tools-report-check",
        `report_path=${REPORT_REL}`,
        `report_bytes=${report.length}`,
        `headings_ok=${headingsOk}`,
        ...headings.map((h) => `heading_present=${report.includes(h)}:${h}`),
      ].join("\n") + "\n",
    );

    writeFileSync(
      join(SCRATCH, "course-authoring-tools-source-crosscheck.log"),
      [
        "course-authoring-tools-source-crosscheck",
        `section_keys=${WORKSPACE_SECTION_KEYS.join(",")}`,
        `sections_all_in_report=${sectionsOk}`,
        ...WORKSPACE_SECTION_KEYS.map(
          (k) => `section_${k}=${report.includes(`\`${k}\``)}`,
        ),
        `demoted_move=${report.includes("`move`")}`,
        `generate_shape_noted=${report.includes("generate_shape")}`,
      ].join("\n") + "\n",
    );

    expect(sectionsOk).toBe(true);
    expect(headingsOk).toBe(true);
  });
});
