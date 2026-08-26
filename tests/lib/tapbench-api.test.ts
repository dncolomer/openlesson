/**
 * TAPBench session/link + Stash/Submit entry paths (real shipped helpers).
 */
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  TAPBENCH_POW_SOURCE,
  buildTapbenchExercise,
  buildTapbenchShareUrl,
  classifyPowSource,
  isTapbenchPowMetadata,
  mintAndStoreTapbenchLink,
  mintTapbenchLink,
  remainingMsUntil,
  resetAllTapbenchSessionsForTests,
  resolveStoredTapbenchSession,
  resolveTapbenchSession,
  toTapbenchListRow,
} from "@/lib/pow-api/tapbench";
import {
  bufferSubjectId,
  buildStashDecisionMetadata,
  flushStashBuffer,
  ingestStashUnit,
  resetAllStashBuffersForTests,
  stashBufferedProofOfWork,
  stashExerciseResponseFields,
  submitBufferedProofOfWork,
  unitToPowUploadInput,
  type StashPowFlushUploader,
  type StashTapbenchContext,
} from "@/lib/pow-api/stash-api";
import { extractTapbenchSessionToken } from "@/lib/pow-api/tapbench-store";

const ROOT = join(__dirname, "../..");

const sampleToolPayload = Buffer.from(
  JSON.stringify({ action: "tool_call", tool: "search", args: { q: "algebra" } }),
).toString("base64");

function toolBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "tool",
    mime_type: "application/json",
    data: sampleToolPayload,
    tool_name: "search",
    tool_action: "query",
    metadata: { step: 1 },
    ...overrides,
  };
}

const mockAuth = {
  user_id: "user-abc",
  guest_user_id: null as string | null,
  organization_id: "org-1",
  is_org_admin: false,
  key_id: "key-1",
  scopes: ["workspaces:write" as const],
};

const mockWorkspace = {
  id: "ws-1",
  user_id: "user-abc",
  organization_id: "org-1",
};

const mockSupabase = {} as never;

describe("TAPBench mint / resolve / expiry", () => {
  beforeEach(() => {
    resetAllTapbenchSessionsForTests();
    resetAllStashBuffersForTests();
  });

  it("mints workspace-scoped link with exercise + duration + session token", () => {
    const now = 1_700_000_000_000;
    const minted = mintTapbenchLink(
      {
        workspaceId: "ws-1",
        workspaceTitle: "Linear Algebra",
        exerciseText:
          "Exercise: Solve Ax = b for a 2×2 invertible matrix and box both unknowns.",
        durationSeconds: 900,
        nowMs: now,
        sessionToken: "tb_ws_token_abc",
        id: "link-ws-1",
      },
      "https://example.com",
    );

    expect(minted.session_token).toBe("tb_ws_token_abc");
    expect(minted.exercise.length).toBeGreaterThan(0);
    expect(minted.exercise.toLowerCase()).toMatch(/exercise|solve|matrix/);
    expect(minted.duration_seconds).toBe(900);
    expect(minted.expires_at).toBe(new Date(now + 900_000).toISOString());
    expect(minted.remaining_ms).toBe(900_000);
    expect(minted.url).toBe("https://example.com/tapbench/tb_ws_token_abc");
    expect(minted.link.public_token).toBe(minted.session_token);
    expect(minted.link.block_id).toBeNull();
  });

  it("mints block-scoped link with explicit model exercise text", () => {
    const minted = mintTapbenchLink({
      workspaceId: "ws-1",
      blockId: "block-42",
      blockTitle: "Eigenvalues",
      blockDescription: "Compute characteristic polynomial",
      exerciseText:
        "Exercise: For matrix A = [[2,1],[0,3]], compute eigenvalues and box both.",
      durationSeconds: 600,
      sessionToken: "tb_block_token",
    });

    expect(minted.link.block_id).toBe("block-42");
    expect(minted.exercise).toMatch(/eigenvalues|matrix/i);
    expect(minted.exercise.toLowerCase()).toMatch(/exercise/);
    expect(minted.duration_seconds).toBe(600);
  });

  it("resolve yields exercise + remaining time + session token while valid", () => {
    const now = 1_700_000_000_000;
    const minted = mintAndStoreTapbenchLink({
      workspaceId: "ws-1",
      workspaceTitle: "Graphs",
      exerciseText: "Exercise: Count paths of length 2 in K3.",
      durationSeconds: 120,
      nowMs: now,
      sessionToken: "tb_resolve_ok",
      id: "link-resolve",
    });

    const resolved = resolveStoredTapbenchSession("tb_resolve_ok", now + 30_000);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.exercise).toBe(minted.exercise);
    expect(resolved.session_token).toBe("tb_resolve_ok");
    expect(resolved.remaining_ms).toBe(90_000);
    expect(resolved.valid).toBe(true);
    expect(resolved.workspace_id).toBe("ws-1");
  });

  it("expired token is rejected with session_expired", () => {
    const now = 1_700_000_000_000;
    mintAndStoreTapbenchLink({
      workspaceId: "ws-1",
      exerciseText: "Exercise: unit test placeholder",
      durationSeconds: 60,
      nowMs: now,
      sessionToken: "tb_expired",
      id: "link-exp",
    });

    const resolved = resolveStoredTapbenchSession("tb_expired", now + 61_000);
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.code).toBe("session_expired");
    if (resolved.code === "session_expired") {
      expect(resolved.remaining_ms).toBe(0);
    }
  });

  it("list row always includes stable share URL from public_token", () => {
    const minted = mintAndStoreTapbenchLink({
      workspaceId: "ws-list",
      exerciseText: "Exercise: list-row mint",
      durationSeconds: 300,
      sessionToken: "tb_list_token",
      id: "link-list",
    });
    const row = toTapbenchListRow(minted.link, "https://app.test");
    expect(row.url).toBe("https://app.test/tapbench/tb_list_token");
    expect(row.public_token).toBe("tb_list_token");
    expect(row.id).toBe("link-list");
  });

  it("buildTapbenchExercise is empty without explicit exerciseText", () => {
    expect(buildTapbenchExercise({}).trim()).toBe("");
    expect(
      buildTapbenchExercise({ workspaceTitle: "Calc", blockTitle: "Limits" }),
    ).toBe("");
    expect(
      buildTapbenchExercise({
        exerciseText: "Exercise: Evaluate lim x→0 sin(x)/x.",
      }),
    ).toMatch(/sin|limit|Exercise/i);
  });
});

describe("Stash/Submit with TAPBench session — real flush helpers", () => {
  beforeEach(() => {
    resetAllTapbenchSessionsForTests();
    resetAllStashBuffersForTests();
  });

  function makeTapbenchCtx(overrides: Partial<StashTapbenchContext> = {}): StashTapbenchContext {
    return {
      linkId: "tb-link-1",
      exercise: "Exercise: Work through eigenvalues out loud.",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      remaining_ms: 60_000,
      duration_seconds: 900,
      session_token: "tb_sess",
      block_id: "block-1",
      workspace_id: "ws-1",
      guest_user_id: "22222222-2222-4222-8222-222222222222",
      ...overrides,
    };
  }

  it("valid token allows stash then submit flush; response fields include exercise; PoW is tapbench", async () => {
    const subject = bufferSubjectId(mockAuth);
    expect(ingestStashUnit("ws-1", subject, toolBody()).ok).toBe(true);

    const tapbench = makeTapbenchCtx();
    const metas: Record<string, unknown>[] = [];
    const uploader: StashPowFlushUploader = async ({ unit, decision, workspaceId, tapbench: tb }) => {
      const input = unitToPowUploadInput(unit, decision, tb);
      input.workspaceId = workspaceId;
      metas.push(input.metadata as Record<string, unknown>);
      return { id: `pow-${metas.length}`, metadata: input.metadata, workspace_id: workspaceId };
    };

    const stash = await stashBufferedProofOfWork({
      workspaceId: "ws-1",
      subjectId: subject,
      auth: mockAuth,
      workspace: mockWorkspace,
      supabase: mockSupabase,
      tapbench,
      uploader,
    });

    expect(stash.ok).toBe(true);
    if (!stash.ok) return;
    expect(stash.flushed).toBe(1);
    expect(stash.tapbench?.exercise).toContain("eigenvalues");
    expect(stashExerciseResponseFields(stash.tapbench).exercise).toBeDefined();
    expect(metas[0]?.tapbench).toBe(true);
    expect(metas[0]?.pow_source).toBe(TAPBENCH_POW_SOURCE);
    expect(metas[0]?.source).toBe(TAPBENCH_POW_SOURCE);
    expect(metas[0]?.source_link_id).toBe("tb-link-1");
    expect(isTapbenchPowMetadata(metas[0])).toBe(true);
    expect(classifyPowSource(metas[0])).toBe("tapbench");

    // Second unit for submit
    expect(ingestStashUnit("ws-1", subject, toolBody({ tool_name: "submit_tool" })).ok).toBe(true);
    const submit = await submitBufferedProofOfWork({
      workspaceId: "ws-1",
      subjectId: subject,
      auth: mockAuth,
      workspace: mockWorkspace,
      supabase: mockSupabase,
      tapbench,
      uploader,
    });
    expect(submit.ok).toBe(true);
    if (!submit.ok) return;
    expect(submit.flushed).toBe(1);
    expect(metas[1]?.tapbench).toBe(true);
    expect(metas[1]?.decision).toBe("submit");
    expect(metas[1]?.system).toBe(2);
  });

  it("non-tapbench stash is distinguishable from tapbench pow", () => {
    const humanish = buildStashDecisionMetadata("stash", { note: "agent" });
    const tb = buildStashDecisionMetadata("stash", {}, makeTapbenchCtx());
    expect(isTapbenchPowMetadata(humanish)).toBe(false);
    expect(classifyPowSource(humanish)).toBe("human");
    expect(humanish.alatap).toBeUndefined();
    expect(isTapbenchPowMetadata(tb)).toBe(true);
    expect(tb.alatap).toBeUndefined();
  });

  it("resolve + remainingMsUntil marks expiry boundary for token rejection logic", () => {
    const now = 1_000_000;
    const minted = mintTapbenchLink({
      workspaceId: "ws-1",
      exerciseText: "Exercise: boundary",
      durationSeconds: 60, // min duration
      nowMs: now,
      sessionToken: "tb_boundary",
      id: "b1",
    });
    expect(minted.duration_seconds).toBe(60);
    expect(remainingMsUntil(minted.expires_at, now + 59_999)).toBeGreaterThan(0);
    expect(remainingMsUntil(minted.expires_at, now + 60_000)).toBe(0);
    const expired = resolveTapbenchSession(minted.link, "tb_boundary", now + 60_000);
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.code).toBe("session_expired");
  });

  it("extractTapbenchSessionToken reads header and body", () => {
    expect(
      extractTapbenchSessionToken({
        authorizationHeader: "Bearer api_key_xxx",
        tapbenchHeader: "tb_from_header",
      }),
    ).toBe("tb_from_header");
    expect(
      extractTapbenchSessionToken({
        bodySessionToken: "tb_from_body",
      }),
    ).toBe("tb_from_body");
  });
});

describe("TAPBench surface contracts (routes + UI)", () => {
  it("ships mint/resolve/list routes, public page, and core modules", () => {
    const files = [
      "lib/pow-api/tapbench.ts",
      "lib/pow-api/tapbench-store.ts",
      "lib/pow-api/stash-tapbench-auth.ts",
      "lib/pow-api/stash-api.ts",
      "app/api/tapbench/[token]/route.ts",
      "app/api/tapbench/[token]/skills/route.ts",
      "app/tapbench/[token]/page.tsx",
      "app/api/v3/stash/workspaces/[id]/stash/route.ts",
      "app/api/v3/stash/workspaces/[id]/submit/route.ts",
      "app/api/v3/stash/workspaces/[id]/proof-of-work/route.ts",
      "supabase/migrations/20260731120000_workspace_tapbench_links.sql",
    ];
    for (const f of files) {
      expect(existsSync(join(ROOT, f)), f).toBe(true);
    }
    // Share URL path matches public page; API is sibling under /api/tapbench
    const page = readFileSync(join(ROOT, "app/tapbench/[token]/page.tsx"), "utf8");
    expect(page).toContain("resolveTapbenchSessionToken");
    expect(page).toContain("data-tapbench-exercise");
    expect(page).toContain("data-tapbench-session-token");
    expect(page).toContain("data-tapbench-remaining");
    // Agents visiting the link are pointed at skills.md
    expect(page).toContain("buildTapbenchSkillsMarkdown");
    expect(page).toContain("data-tapbench-skills-md");
    expect(page).toContain("data-download-tapbench-skills");
    expect(page).toContain("skills_md_url");
    expect(page).toContain("TAPBENCH_SKILLS_MD_FILENAME");
    expect(page).toContain("/skills");
    const resolveApi = readFileSync(join(ROOT, "app/api/tapbench/[token]/route.ts"), "utf8");
    expect(resolveApi).toContain("skills_md_url");
    expect(resolveApi).toContain("skills.md");
    const skillsApi = readFileSync(
      join(ROOT, "app/api/tapbench/[token]/skills/route.ts"),
      "utf8",
    );
    expect(skillsApi).toContain("buildTapbenchSkillsMarkdown");
    expect(skillsApi).toContain("text/markdown");
    const mw = readFileSync(join(ROOT, "middleware.ts"), "utf8");
    expect(mw).toContain("/tapbench");
    const share = readFileSync(join(ROOT, "lib/pow-api/tapbench.ts"), "utf8");
    expect(share).toContain('TAPBENCH_PUBLIC_PATH = "tapbench"');
  });

  it("stash routes wire exercise response + tapbench auth", () => {
    for (const rel of [
      "app/api/v3/stash/workspaces/[id]/stash/route.ts",
      "app/api/v3/stash/workspaces/[id]/submit/route.ts",
      "app/api/v3/stash/workspaces/[id]/proof-of-work/route.ts",
    ]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).toContain("stashExerciseResponseFields");
      expect(src).toContain("authenticateStashRequest");
      expect(src).not.toMatch(/alatap|alaTAP/i);
    }
  });

  it("Knowledge Links does not mint TAPBench; Regions keeps builder filters", () => {
    const regions = readFileSync(join(ROOT, "components/CustomVerificationModelsPanel.tsx"), "utf8");
    expect(regions).toContain("data-region-builder");
    expect(regions).toContain("data-region-source-filter");
    expect(regions).toContain("data-region-link-filter");
    expect(regions).toContain("tapbench");
    expect(regions).toContain("human");
    expect(regions).not.toContain("data-create-tapbench-link");
    expect(regions).not.toContain("/api/workspace/tapbench-links");
    expect(regions).not.toContain('action: "create_synthetic"');
    expect(regions).not.toContain("data-create-synthetic-region");
    expect(regions).not.toContain("Create from description or files");
    expect(regions).not.toMatch(/alatap|alaTAP/i);

    expect(existsSync(join(ROOT, "components/WorkspaceTapbenchLinksPanel.tsx"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "app/api/workspace/tapbench-links/route.ts"))).toBe(
      false,
    );
  });
});
