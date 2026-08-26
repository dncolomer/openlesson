/**
 * One TAPBench results row per workspace, best region first.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TapbenchTask } from "@/lib/tapbench/catalog";
import type { TapbenchPublicRegion } from "@/lib/tapbench/region";
import { TAPBENCH_OWNER_EMAIL } from "@/lib/tapbench/constants";
import { presentTapbenchTaskIntro } from "@/lib/tapbench/catalog";
import {
  TAPBENCH_WORKSPACE_TOP_N,
  pickBestTapbenchRegion,
  tapbenchWorkspaceHref,
  tapbenchWorkspaceRows,
  topTapbenchRegions,
} from "@/lib/tapbench/task-rows";

const ROOT = join(__dirname, "../..");

function task(id: string, title: string): TapbenchTask {
  return {
    id,
    title,
    root_topic: null,
    description: null,
    cover_image_url: null,
    created_at: null,
    owner_email: TAPBENCH_OWNER_EMAIL,
  };
}

function region(
  overrides: Partial<TapbenchPublicRegion> & { id: string; workspace_id: string },
): TapbenchPublicRegion {
  return {
    name: "region",
    subject_count: 1,
    cosine_threshold: 0.9,
    mean_radius: 0.01,
    cohort_cohesion: 0.99,
    guest_user_ids: [],
    created_at: "2026-08-26T19:00:00.000Z",
    in_region: false,
    distance_to_center: 0.5,
    distance_to_closest_border: 0.2,
    owner_snapshot_as_of_ms: 1,
    ...overrides,
  };
}

describe("TAPBench workspace result rows", () => {
  it("picks in-region then nearer center as best", () => {
    const farIn = region({
      id: "in-far",
      workspace_id: "ws",
      in_region: true,
      distance_to_center: 0.4,
    });
    const nearOut = region({
      id: "out-near",
      workspace_id: "ws",
      in_region: false,
      distance_to_center: 0.1,
    });
    const nearIn = region({
      id: "in-near",
      workspace_id: "ws",
      in_region: true,
      distance_to_center: 0.05,
    });
    expect(pickBestTapbenchRegion([farIn, nearOut, nearIn])?.id).toBe("in-near");
    expect(pickBestTapbenchRegion([nearOut, farIn])?.id).toBe("in-far");
  });

  it("emits one row per catalog task even without a region", () => {
    const rows = tapbenchWorkspaceRows(
      [task("ws-a", "Algebra"), task("ws-b", "Tao")],
      [
        region({
          id: "r1",
          workspace_id: "ws-b",
          name: "Tao Lean five-lemma cohort",
          in_region: false,
          distance_to_center: 0.91,
        }),
        region({
          id: "r2",
          workspace_id: "ws-b",
          name: "weaker",
          in_region: false,
          distance_to_center: 1.2,
        }),
      ],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].task.id).toBe("ws-a");
    expect(rows[0].best).toBeNull();
    expect(rows[1].best?.id).toBe("r1");
    expect(tapbenchWorkspaceHref("ws-b")).toBe("/tapbench/workspace/ws-b");
  });

  it("ranks and slices the top 10 regions for a workspace", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      region({
        id: `r${i}`,
        workspace_id: "ws",
        name: `r${i}`,
        in_region: i === 0,
        distance_to_center: 0.1 + i * 0.01,
      }),
    );
    const top = topTapbenchRegions(many);
    expect(TAPBENCH_WORKSPACE_TOP_N).toBe(10);
    expect(top).toHaveLength(10);
    expect(top[0].id).toBe("r0");
    expect(top.map((r) => r.id)).not.toContain("r11");
  });

  it("prefers workspace_goal for the task intro when title matches description", () => {
    const tao = task("ws-tao", "Terence Tao - Mathematics Benchmark");
    tao.description = "Terence Tao - Mathematics Benchmark";
    const intro = presentTapbenchTaskIntro(
      tao,
      "Lean Proofs - Formalizing a proof in Lean by hand",
    );
    expect(intro.name).toBe("Terence Tao - Mathematics Benchmark");
    expect(intro.description).toBe("Lean Proofs - Formalizing a proof in Lean by hand");
    expect(presentTapbenchTaskIntro(tao, null).description).toBeNull();
  });

  it("workspace TAPBench page shows intro, image, and top 10 results", () => {
    expect(existsSync(join(ROOT, "app/tapbench/workspace/[id]/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "components/TapbenchWorkspaceComingSoon.tsx"))).toBe(false);
    const landing = readFileSync(join(ROOT, "components/TapbenchLanding.tsx"), "utf8");
    const table = readFileSync(join(ROOT, "components/TapbenchResultsTable.tsx"), "utf8");
    const page = readFileSync(join(ROOT, "app/tapbench/workspace/[id]/page.tsx"), "utf8");
    const detail = readFileSync(join(ROOT, "components/TapbenchWorkspaceDetail.tsx"), "utf8");
    expect(landing).not.toContain("Browse tasks");
    expect(landing).not.toContain("data-tapbench-benchmark-tasks");
    expect(landing).not.toContain("data-tapbench-select-all");
    expect(table).not.toContain("data-tapbench-col-filter");
    expect(table).not.toContain("data-tapbench-pagination");
    expect(table).toContain("tapbenchWorkspaceRows");
    expect(table).toContain("data-tapbench-issue-key");
    expect(table).toContain("data-tapbench-download-skill");
    expect(table).toContain("tapbenchWorkspaceHref");
    expect(page).toContain("TapbenchWorkspaceDetail");
    expect(page).toContain("presentTapbenchTaskIntro");
    expect(page).toContain("listTapbenchPublicRegions");
    expect(detail).toContain('href="/tapbench"');
    expect(detail).toContain("data-tapbench-back");
    expect(detail).toContain("data-tapbench-workspace-intro");
    expect(detail).toContain("data-tapbench-workspace-description");
    expect(detail).toContain("data-tapbench-workspace-image");
    expect(detail).toContain("data-tapbench-workspace-results-table");
    expect(detail).toContain("TAPBENCH_WORKSPACE_TOP_N");
    expect(detail).toContain("topTapbenchRegions");
    expect(detail).not.toContain("Coming Soon");
  });
});

