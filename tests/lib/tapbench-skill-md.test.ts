import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TAPBENCH_WRAP_SKILL_FILENAME,
  buildTapbenchWrapSkillMarkdown,
} from "@/lib/tapbench/skill-md";

const ROOT = join(__dirname, "../..");

describe("TAPBench wrap skill.md", () => {
  it("lists selected tasks and live Stash/Submit with the TAPBench key", () => {
    const md = buildTapbenchWrapSkillMarkdown({
      origin: "https://uncertain.systems",
      tasks: [
        {
          id: "ws-a",
          title: "Algebra",
          key: "tbk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        { id: "ws-b", title: "Graphs" },
      ],
    });
    expect(TAPBENCH_WRAP_SKILL_FILENAME).toBe("skills.md");
    expect(md).toContain("# TAPBench");
    expect(md).toContain("ws-a");
    expect(md).toContain("ws-b");
    expect(md).toContain("tbk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(md).toContain("<TAPBench key>");
    expect(md).toContain("/api/v3/stash/workspaces/ws-a/proof-of-work");
    expect(md).toContain("/api/v3/stash/workspaces/ws-a/stash");
    expect(md).toContain("/api/v3/stash/workspaces/ws-a/submit");
    expect(md).not.toContain("/api/v3/tapbench/tasks/ws-a/runs");
    expect(md).not.toContain("/api/v3/pow/workspaces/ws-a/proof-of-work");
    expect(md).toContain("Stash API");
    expect(md).toContain("Do not dump one finished run");
    expect(md).toContain("agentic_harness");
    expect(md).toContain("/api/v3/tapbench/results?mine=1");
    expect(md).toContain("/api/v3/tapbench/tasks/ws-a/goals");
    expect(md).toContain("What to demonstrate");
    expect(md).toContain("/api/v3/tapbench/tasks/ws-a/stop");
    expect(md).toContain("session_stopped");
    expect(md).toContain("## Experiment");
    expect(md).toContain("guest_user_id");
    expect(md).toContain("X-Tapbench-Guest");
    expect(md).toContain("/api/v3/tapbench/tasks/ws-a/guests");
    expect(md).toContain("/api/v3/tapbench/tasks/ws-a/snapshot");
    expect(md).toContain("/api/v3/tapbench/tasks/ws-a/region");
    expect(md).toContain("One guest snapshot is not a region");
    expect(md).toContain("`name` is the public Results label");
    expect(md).not.toContain("in_region");
  });

  it("skill and batch-key routes exist", () => {
    expect(existsSync(join(ROOT, "app/api/v3/tapbench/skill/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/v3/tapbench/keys/route.ts"))).toBe(true);
    const skill = readFileSync(join(ROOT, "app/api/v3/tapbench/skill/route.ts"), "utf8");
    expect(skill).toContain("buildTapbenchWrapSkillMarkdown");
    expect(skill).toContain("workspace_ids");
    expect(readFileSync(join(ROOT, "app/api/v3/tapbench/keys/route.ts"), "utf8")).toContain(
      "workspace_ids",
    );
  });
});
