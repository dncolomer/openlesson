/**
 * Cheap TAP Learning “do chapters already exist?” check.
 * Drives the shipped helper + the welcome load/confirm client entry.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import {
  SESSION_PLAN_EMPTY_STEPS_JSON,
  SESSION_PLAN_HAS_CHAPTERS_SELECT,
  sessionPlanChaptersStatus,
  sessionPlanChaptersStatusFromResult,
  sessionPlanHasChaptersFromRow,
  sessionPlanHasChaptersQuery,
} from "@/lib/storage/session-plans";
import {
  SESSION_PLAN_HAS_CHAPTERS_PATH,
  chapterStatusAfterHydrate,
  fetchWelcomeChapterSnapshot,
  welcomePlanFromPayload,
} from "@/lib/session-plan-chapters-status";
import { lookupSessionPlanChaptersForRequest } from "@/lib/session-plan-has-chapters-request";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-7249dfcaf2a6/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

type RecordedQuery = {
  table: string | null;
  select: string | null;
  eq: Array<[string, unknown]>;
  not: Array<[string, string, unknown]>;
};

function createRecordingClient(result: { data: unknown; error: unknown }) {
  const recorded: RecordedQuery = {
    table: null,
    select: null,
    eq: [],
    not: [],
  };
  const builder = {
    select(cols: string) {
      recorded.select = cols;
      return this;
    },
    eq(col: string, val: unknown) {
      recorded.eq.push([col, val]);
      return this;
    },
    not(col: string, op: string, val: unknown) {
      recorded.not.push([col, op, val]);
      return this;
    },
    maybeSingle() {
      return Promise.resolve(result);
    },
  };
  return {
    recorded,
    from(table: string) {
      recorded.table = table;
      return builder;
    },
  };
}

describe("sessionPlanChaptersStatus (shipped existence helper)", () => {
  it("returns exists / empty / failed — error is not empty", async () => {
    const withChapters = createRecordingClient({
      data: { id: "plan-1" },
      error: null,
    });
    const missing = createRecordingClient({ data: null, error: null });
    const emptyShell = createRecordingClient({
      data: { id: "plan-empty", steps: [] },
      error: null,
    });
    const queryError = createRecordingClient({
      data: null,
      error: { message: "operator does not exist", code: "42883" },
    });

    expect(await sessionPlanChaptersStatus("sess-1", withChapters)).toBe("exists");
    expect(await sessionPlanChaptersStatus("sess-2", missing)).toBe("empty");
    expect(await sessionPlanChaptersStatus("sess-3", emptyShell)).toBe("empty");
    expect(await sessionPlanChaptersStatus("sess-4", queryError)).toBe("failed");
    expect(await sessionPlanChaptersStatus("sess-5", null)).toBe("failed");

    expect(sessionPlanChaptersStatusFromResult({ data: { id: "plan-1" }, error: null })).toBe(
      "exists",
    );
    expect(sessionPlanChaptersStatusFromResult({ data: null, error: null })).toBe("empty");
    expect(
      sessionPlanChaptersStatusFromResult({
        data: null,
        error: { message: "boom" },
      }),
    ).toBe("failed");

    expect(sessionPlanHasChaptersFromRow({ id: "plan-1" })).toBe(true);
    expect(sessionPlanHasChaptersFromRow(null)).toBe(false);
    expect(sessionPlanHasChaptersFromRow({ id: "x", steps: [] })).toBe(false);

    writeScratch(
      "chapter-exists-query.txt",
      [
        `select=${withChapters.recorded.select}`,
        `table=${withChapters.recorded.table}`,
        `exists=${await sessionPlanChaptersStatus("sess-1", createRecordingClient({ data: { id: "plan-1" }, error: null }))}`,
        `missing=${await sessionPlanChaptersStatus("sess-2", createRecordingClient({ data: null, error: null }))}`,
        `emptyShell=${await sessionPlanChaptersStatus("sess-3", createRecordingClient({ data: { id: "e", steps: [] }, error: null }))}`,
        `queryError=${await sessionPlanChaptersStatus("sess-4", createRecordingClient({ data: null, error: { message: "x" } }))}`,
      ].join("\n"),
    );
  });

  it("issues an id-only projection and does not select * or the steps array", async () => {
    const client = createRecordingClient({ data: { id: "plan-1" }, error: null });
    await sessionPlanChaptersStatus("sess-q", client);

    expect(SESSION_PLAN_HAS_CHAPTERS_SELECT).toBe("id");
    expect(SESSION_PLAN_HAS_CHAPTERS_SELECT).not.toContain("*");
    expect(SESSION_PLAN_HAS_CHAPTERS_SELECT).not.toContain("steps");
    expect(client.recorded.table).toBe("session_plans");
    expect(client.recorded.select).toBe(SESSION_PLAN_HAS_CHAPTERS_SELECT);
    expect(client.recorded.eq).toContainEqual(["session_id", "sess-q"]);
    expect(client.recorded.not).toContainEqual([
      "steps",
      "eq",
      SESSION_PLAN_EMPTY_STEPS_JSON,
    ]);

    const qClient = createRecordingClient({ data: null, error: null });
    sessionPlanHasChaptersQuery(qClient, "sess-q");
    expect(qClient.recorded.select).toBe("id");
    expect(qClient.recorded.select).not.toMatch(/\*|steps/);
  });
});

describe("lookupSessionPlanChaptersForRequest (guard / privileged client)", () => {
  it("passes TAP Learning tokens to guardSessionRoute and looks up on that supabase client", async () => {
    const privileged = createRecordingClient({
      data: { id: "plan-ile" },
      error: null,
    });
    const browser = createRecordingClient({ data: null, error: null });
    const seenTokens: { ileToken?: string | null } = {};

    const result = await lookupSessionPlanChaptersForRequest(
      { sessionId: "sess-ile", ileToken: "ile-guest-token" },
      async (_sessionId, options) => {
        seenTokens.ileToken = options?.ileToken ?? null;
        return {
          ok: true,
          principal: { kind: "ile_guest", subjectId: "guest-1" },
          subjectId: "guest-1",
          persistUserId: "owner-1",
          supabase: privileged as never,
        };
      },
    );

    expect(seenTokens.ileToken).toBe("ile-guest-token");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe("exists");
    expect(privileged.recorded.table).toBe("session_plans");
    expect(browser.recorded.table).toBeNull();
  });

  it("passes AYCL tokens to guard and reports empty vs failed from that client", async () => {
    const emptyClient = createRecordingClient({ data: null, error: null });
    const failClient = createRecordingClient({
      data: null,
      error: { message: "rls" },
    });

    const empty = await lookupSessionPlanChaptersForRequest(
      { sessionId: "sess-aycl", ayclToken: "aycl-purchase-token" },
      async (_sessionId, options) => {
        expect(options?.ayclToken).toBe("aycl-purchase-token");
        return {
          ok: true,
          principal: { kind: "aycl", subjectId: "aycl:p1" },
          subjectId: "aycl:p1",
          persistUserId: "owner-1",
          supabase: emptyClient as never,
        };
      },
    );
    expect(empty.ok).toBe(true);
    if (empty.ok) {
      expect(empty.status).toBe("empty");
      expect(empty.plan).toBeNull();
    }

    const failed = await lookupSessionPlanChaptersForRequest(
      { sessionId: "sess-aycl", ayclToken: "aycl-purchase-token" },
      async () => ({
        ok: true,
        principal: { kind: "aycl", subjectId: "aycl:p1" },
        subjectId: "aycl:p1",
        persistUserId: "owner-1",
        supabase: failClient as never,
      }),
    );
    expect(failed.ok).toBe(true);
    if (failed.ok) expect(failed.status).toBe("failed");
  });

  it("cookie-owner guard client still sees owner-attributed populated rows", async () => {
    const ownerClient = createRecordingClient({
      data: { id: "plan-owner" },
      error: null,
    });
    const result = await lookupSessionPlanChaptersForRequest(
      { sessionId: "sess-owner" },
      async (_sessionId, options) => {
        expect(options?.ileToken ?? null).toBeNull();
        expect(options?.ayclToken ?? null).toBeNull();
        return {
          ok: true,
          principal: { kind: "cookie_user", subjectId: "owner-1" },
          subjectId: "owner-1",
          persistUserId: "owner-1",
          supabase: ownerClient as never,
        };
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe("exists");
    expect(ownerClient.recorded.eq).toContainEqual(["session_id", "sess-owner"]);
  });

  it("forwards guard auth failures instead of treating them as empty", async () => {
    const denied = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const result = await lookupSessionPlanChaptersForRequest(
      { sessionId: "sess-1", ileToken: "bad" },
      async () => ({ ok: false, response: denied }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response).toBe(denied);
  });
});

describe("fetchWelcomeChapterSnapshot (welcome load entry)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs sessionId plus TAP Learning/AYCL tokens", async () => {
    const posts: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        posts.push({ url: String(url), body });
        return new Response(JSON.stringify({ status: "exists" }), { status: 200 });
      },
    );

    expect(
      (await fetchWelcomeChapterSnapshot("sess-1", { ileToken: "ile-guest-token" })).status,
    ).toBe("exists");
    expect(
      (await fetchWelcomeChapterSnapshot("sess-2", { ayclToken: "aycl-purchase-token" })).status,
    ).toBe("exists");

    expect(posts[0].url).toBe(SESSION_PLAN_HAS_CHAPTERS_PATH);
    expect(posts[0].body).toEqual({
      sessionId: "sess-1",
      ileToken: "ile-guest-token",
    });
    expect(posts[1].body).toEqual({
      sessionId: "sess-2",
      ayclToken: "aycl-purchase-token",
    });
  });

  it("maps HTTP / transport / query failure to failed, not empty", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ error: "nope" }), { status: 500 }),
    );
    expect(
      (await fetchWelcomeChapterSnapshot("sess-1", { ileToken: "t" })).status,
    ).toBe("failed");

    vi.stubGlobal("fetch", async () => {
      throw new Error("network");
    });
    expect((await fetchWelcomeChapterSnapshot("sess-1")).status).toBe("failed");

    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ status: "empty" }), { status: 200 }),
    );
    expect((await fetchWelcomeChapterSnapshot("sess-1")).status).toBe("empty");
  });
});

describe("welcome hydrate", () => {
  it("does not paint empty when hydrate misses after exists/failed", () => {
    expect(welcomePlanFromPayload(null)).toBeNull();
    expect(welcomePlanFromPayload({ sessionId: "s" })).toBeNull();
    const fromArray = welcomePlanFromPayload({
      sessionId: "s1",
      steps: [{ id: "a", description: "One", status: "pending", type: "task", order: 0 }],
    });
    expect(fromArray?.steps).toHaveLength(1);
    const fromJson = welcomePlanFromPayload({
      session_id: "s2",
      steps: JSON.stringify([
        { id: "b", description: "Two", status: "pending", type: "task", order: 1 },
      ]),
    });
    expect(fromJson?.sessionId).toBe("s2");
    expect(fromJson?.steps).toHaveLength(1);
    expect(chapterStatusAfterHydrate("exists", null)).toBe("exists");
    expect(chapterStatusAfterHydrate("failed", null)).toBe("failed");
    expect(chapterStatusAfterHydrate("empty", null)).toBe("empty");
    expect(
      chapterStatusAfterHydrate("empty", { steps: [{ id: "s1" }] }),
    ).toBe("exists");
  });
});

describe("SessionView load/confirm wiring", () => {
  it("load + confirm use the token-aware fetch; no default-client sessionPlanHasChapters", () => {
    const view = readSessionViewSurface();
    expect(view).toContain("fetchWelcomeChapterSnapshot");
    expect(view).toContain("guestAccessBody");
    expect(view).toContain("loadSessionBranchField");
    expect(view).not.toContain("session-plan/create");
    expect(view).not.toMatch(
      /sessionPlanHasChapters\(\s*(s|session)\.id\s*\)/,
    );

    const loadFetch = view.indexOf("fetchWelcomeChapterSnapshot");
    const objectives = view.indexOf("/api/generate-objectives");
    expect(loadFetch).toBeGreaterThan(-1);
    expect(objectives).toBeGreaterThan(loadFetch);

    const route = read("app/api/session-plan/has-chapters/route.ts");
    expect(route).toContain("lookupSessionPlanChaptersForRequest");
    const lookup = read("lib/session-plan-has-chapters-request.ts");
    expect(lookup).toContain("guardSessionRoute");
    expect(lookup).toContain("ileTokenFromBody");
    expect(lookup).toContain("ayclTokenFromBody");
    expect(lookup).toContain("sessionPlanChaptersStatus(sessionId, auth.supabase)");

    expect(existsSync(join(ROOT, "app/api/session-plan/create/route.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/session-plan/translate/route.ts"))).toBe(false);

    writeScratch(
      "chapter-exists-excerpts.txt",
      [
        "load: fetchWelcomeChapterSnapshot then optional getSessionPlan hydrate",
        "confirm: language metadata then loadSessionBranchField from session.problem",
        "has-chapters route: lookupSessionPlanChaptersForRequest → guardSessionRoute",
        `SESSION_PLAN_HAS_CHAPTERS_SELECT=${SESSION_PLAN_HAS_CHAPTERS_SELECT}`,
      ].join("\n"),
    );
  });
});

describe("Confirm is blocked only while start is preparing", () => {
  it("is not held by chapter existence", () => {
    expect(existsSync(join(ROOT, "components/session-view/learn-confirm-settings.ts"))).toBe(
      false,
    );
    const welcome = read("components/session-view/session-welcome-modal.tsx");
    expect(welcome).toContain("disabled={isPreparing}");
    expect(welcome).toContain("if (isPreparing)");
    expect(welcome).not.toContain("isIleConfirmSettingsBlocked");

    const load = read("components/session-view/use-session-phase.ts");
    expect(read("lib/session-plan-chapters-status.ts")).toContain(
      "welcomePlanFromPayload",
    );
    const startLoading = load.indexOf("setPlanLoading(true)");
    const startCheck = load.indexOf(
      "const chapterStatusPromise = fetchWelcomeChapterSnapshot",
    );
    expect(startLoading).toBeGreaterThan(-1);
    expect(startCheck).toBeGreaterThan(startLoading);
    const setFromCheap = load.indexOf(
      "void chapterStatusPromise.then((snapshot) => {",
    );
    const objectives = load.indexOf("/api/generate-objectives");
    expect(startCheck).toBeGreaterThan(-1);
    expect(setFromCheap).toBeGreaterThan(startCheck);
    expect(objectives).toBeGreaterThan(setFromCheap);
  });
});
