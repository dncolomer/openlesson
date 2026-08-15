/**
 * TAPBench skills.md builder — real shipped helper for agent Stash/Submit instructions.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  TAPBENCH_SESSION_HEADER,
  TAPBENCH_SKILLS_MD_FILENAME,
  buildTapbenchSkillsMarkdown,
  tapbenchSkillsMdFilename,
} from "@/lib/pow-api/tapbench-skills-md";
import { STASH_API_BASE, stashWorkspaceResource } from "@/lib/api/agent-api-paths";
import { TAPBENCH_POW_SOURCE } from "@/lib/pow-api/tapbench";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.TAPBENCH_SKILLS_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-64ca03866230/implementer";

const fixture = {
  workspace_id: "ws-skills-fixture-001",
  block_id: "block-eigen-42",
  id: "tb-link-skills-99",
  session_token: "tb_session_token_skills_abc",
  url: "https://uncertain.systems/tapbench/tb_session_token_skills_abc",
  exercise:
    'Exercise: Work through "Eigenvalues" out loud on your own. Explain your reasoning as you go.',
  duration_seconds: 900,
  expires_at: "2026-07-31T12:15:00.000Z",
  remaining_ms: 600_000,
  status: "active",
  baseUrl: "https://uncertain.systems",
};

describe("buildTapbenchSkillsMarkdown (shipped builder)", () => {
  it("returns non-empty agent-facing markdown with concrete link fields", () => {
    const md = buildTapbenchSkillsMarkdown(fixture);
    expect(md.trim().length).toBeGreaterThan(200);
    expect(md).toContain("# TAPBench agent skill");
    // Concrete inputs from the link payload
    expect(md).toContain(fixture.workspace_id);
    expect(md).toContain(fixture.block_id);
    expect(md).toContain(fixture.session_token);
    expect(md).toContain(fixture.url);
    expect(md).toContain(fixture.exercise);
    expect(md).toContain(fixture.id);
    expect(md).toContain(fixture.expires_at);
    expect(md).toContain("900s");
  });

  it("documents Stash/Submit paths and session header for this workspace", () => {
    const md = buildTapbenchSkillsMarkdown(fixture);
    expect(md).toContain(STASH_API_BASE);
    expect(md).toContain(TAPBENCH_SESSION_HEADER);
    expect(md).toContain(`${TAPBENCH_SESSION_HEADER}: ${fixture.session_token}`);
    expect(md).toContain(stashWorkspaceResource(fixture.workspace_id, "proof-of-work"));
    expect(md).toContain(stashWorkspaceResource(fixture.workspace_id, "stash"));
    expect(md).toContain(stashWorkspaceResource(fixture.workspace_id, "submit"));
    expect(md).toMatch(/POST.*proof-of-work/i);
    expect(md).toMatch(/Stash \(System 1\)/i);
    expect(md).toMatch(/Submit \(System 2\)/i);
  });

  it("explains remaining-time stop behavior and tapbench pow flag", () => {
    const md = buildTapbenchSkillsMarkdown(fixture);
    expect(md).toMatch(/session_expired|stop sending|When to stop/i);
    expect(md).toContain("error.expires_at");
    expect(md).toContain("error.remaining_ms");
    expect(md).toContain("error.tapbench");
    expect(md).toContain("remaining_ms");
    expect(md).toContain("tapbench: true");
    expect(md).toContain(`pow_source: "${TAPBENCH_POW_SOURCE}"`);
    expect(md).not.toMatch(/alatap|alaTAP/i);
  });

  it("mentions resolve URL path to obtain exercise when exercise omitted", () => {
    const md = buildTapbenchSkillsMarkdown({
      ...fixture,
      exercise: null,
    });
    expect(md).toContain(fixture.url);
    expect(md).toContain(`/api/tapbench/${fixture.session_token}`);
    expect(md).toMatch(/obtain the exercise|resolve/i);
  });

  it("filename is skills.md", () => {
    expect(TAPBENCH_SKILLS_MD_FILENAME).toBe("skills.md");
    expect(tapbenchSkillsMdFilename(fixture)).toBe("skills.md");
  });

  it("writes sample markdown for evidence (when scratch writable)", () => {
    const md = buildTapbenchSkillsMarkdown(fixture);
    try {
      writeFileSync(join(SCRATCH, "sample-tapbench-skills.md"), md, "utf8");
      writeFileSync(join(SCRATCH, "sample-skills.md"), md, "utf8");
    } catch {
      // scratch may be absent outside goal harness — content still asserted above
    }
    expect(md.includes(fixture.session_token)).toBe(true);
  });

  it("requires continuous multi-thought buffering (not single smoke unit)", () => {
    const md = buildTapbenchSkillsMarkdown(fixture);
    expect(md).toMatch(/continuous thoughts|Buffer continuously|many different thoughts|many \*\*distinct\*\* thought/i);
    expect(md).toMatch(/distinct/i);
    expect(md).toMatch(/tapbench_smoke|Anti-patterns|smoke unit/i);
    expect(md).toMatch(/do \*\*not\*\*|Do not|Anti-patterns/i);
    // Real free-text fields
    expect(md).toMatch(/text.*reasoning.*content|text` \/ `reasoning` \/ `content/i);
  });

  it("instructs stash for intermediate System 1 and submit for deliberate System 2", () => {
    const md = buildTapbenchSkillsMarkdown(fixture);
    expect(md).toMatch(/Stash \(System 1\)/i);
    expect(md).toMatch(/Submit \(System 2\)/i);
    expect(md).toMatch(/intermediate|spontaneous|park/i);
    expect(md).toMatch(/deliberate|final answer/i);
    expect(md).toMatch(/decision: "stash"|system: 1|System 1 flush/i);
    expect(md).toMatch(/decision: "submit"|system: 2|System 2 flush/i);
    // Interleave, not only end-of-session batch
    expect(md).toMatch(/Interleave|buffer thought|recommended/i);
    expect(md).toMatch(/end-of-session batch|one buffer \+ one flush|Anti-patterns/i);
  });
});

describe("Knowledge Links TAPBench skills download UI", () => {
  it("exposes download control tied to skills.md next to TAPBench link actions", () => {
    const ui = readFileSync(
      join(ROOT, "components/WorkspaceTapbenchLinksPanel.tsx"),
      "utf8",
    );
    expect(ui).toContain("data-download-tapbench-skills");
    expect(ui).toContain("data-tapbench-skills-md");
    expect(ui).toContain("Download skills.md");
    expect(ui).toContain("downloadTapbenchSkills");
    expect(ui).toContain("buildTapbenchSkillsMarkdown");
    expect(ui).toContain("downloadTapbenchSkillsMarkdown");
    expect(ui).toContain("TAPBENCH_SKILLS_MD_FILENAME");
    expect(ui).toContain("skills.md");
    // Still has copy link alongside download
    expect(ui).toContain("data-copy-tapbench-link");
    expect(ui).toContain("data-tapbench-links-list");
  });

  it("ships builder module without alaTAP", () => {
    const rel = "lib/pow-api/tapbench-skills-md.ts";
    expect(existsSync(join(ROOT, rel))).toBe(true);
    const src = readFileSync(join(ROOT, rel), "utf8");
    expect(src).not.toMatch(/alatap|alaTAP/i);
    expect(src).toContain("Stash/Submit");
    expect(src).toContain("TAPBench");
    expect(src).toContain(TAPBENCH_SESSION_HEADER);
  });
});
