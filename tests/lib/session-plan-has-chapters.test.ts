/**
 * Cheap ILE “do chapters already exist?” check.
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
  createForceFromChapterStatus,
  fetchSessionPlanChaptersStatus,
} from "@/lib/session-plan-chapters-status";
import { lookupSessionPlanChaptersForRequest } from "@/lib/session-plan-has-chapters-request";
import { isIleConfirmSettingsBlocked } from "@/components/session-view/ile-confirm-settings";

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
  it("passes ILE tokens to guardSessionRoute and looks up on that supabase client", async () => {
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

describe("fetchSessionPlanChaptersStatus (welcome load/confirm entry)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs sessionId plus ILE/AYCL tokens create/translate use", async () => {
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
      await fetchSessionPlanChaptersStatus("sess-1", { ileToken: "ile-guest-token" }),
    ).toBe("exists");
    expect(
      await fetchSessionPlanChaptersStatus("sess-2", { ayclToken: "aycl-purchase-token" }),
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
    expect(await fetchSessionPlanChaptersStatus("sess-1", { ileToken: "t" })).toBe(
      "failed",
    );

    vi.stubGlobal("fetch", async () => {
      throw new Error("network");
    });
    expect(await fetchSessionPlanChaptersStatus("sess-1")).toBe("failed");

    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ status: "empty" }), { status: 200 }),
    );
    expect(await fetchSessionPlanChaptersStatus("sess-1")).toBe("empty");
  });
});

describe("createForceFromChapterStatus + hydrate", () => {
  it("does not force-replace when the existence check failed", () => {
    expect(createForceFromChapterStatus("failed", false)).toEqual({
      action: "abort",
      reason: "failed",
    });
    expect(createForceFromChapterStatus("unknown", true)).toEqual({
      action: "abort",
      reason: "unknown",
    });
    expect(createForceFromChapterStatus("empty", false)).toEqual({
      action: "create",
      force: true,
    });
    expect(createForceFromChapterStatus("exists", false)).toEqual({
      action: "create",
      force: false,
    });
    expect(createForceFromChapterStatus("exists", true)).toEqual({
      action: "create",
      force: true,
    });
  });

  it("does not paint empty when hydrate misses after exists/failed", () => {
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
    expect(view).toContain("fetchSessionPlanChaptersStatus");
    expect(view).toContain("createForceFromChapterStatus");
    expect(view).toContain("guestAccessBody");
    expect(view).not.toMatch(
      /sessionPlanHasChapters\(\s*(s|session)\.id\s*\)/,
    );

    const loadFetch = view.indexOf("fetchWelcomeChapterSnapshot");
    const objectives = view.indexOf("/api/generate-objectives");
    expect(loadFetch).toBeGreaterThan(-1);
    expect(objectives).toBeGreaterThan(loadFetch);

    const confirmFetch = view.lastIndexOf("fetchSessionPlanChaptersStatus");
    const forceAbort = view.indexOf("forceDecision.action === \"abort\"");
    const createForce = view.indexOf("force: forceDecision.force");
    expect(confirmFetch).toBeGreaterThan(loadFetch);
    expect(forceAbort).toBeGreaterThan(confirmFetch);
    expect(createForce).toBeGreaterThan(forceAbort);

    const route = read("app/api/session-plan/has-chapters/route.ts");
    expect(route).toContain("lookupSessionPlanChaptersForRequest");
    const lookup = read("lib/session-plan-has-chapters-request.ts");
    expect(lookup).toContain("guardSessionRoute");
    expect(lookup).toContain("ileTokenFromBody");
    expect(lookup).toContain("ayclTokenFromBody");
    expect(lookup).toContain("sessionPlanChaptersStatus(sessionId, auth.supabase)");

    const create = read("app/api/session-plan/create/route.ts");
    expect(create).toContain("getSessionPlan");
    const translate = read("app/api/session-plan/translate/route.ts");
    expect(translate).toContain("getSessionPlan");

    writeScratch(
      "chapter-exists-excerpts.txt",
      [
        "load: fetchSessionPlanChaptersStatus then optional getSessionPlan hydrate",
        "confirm: fetchSessionPlanChaptersStatus + createForceFromChapterStatus (abort on failed)",
        "has-chapters route: lookupSessionPlanChaptersForRequest → guardSessionRoute",
        `SESSION_PLAN_HAS_CHAPTERS_SELECT=${SESSION_PLAN_HAS_CHAPTERS_SELECT}`,
      ].join("\n"),
    );
  });
});

describe("Confirm is blocked only until the cheap existence result", () => {
  it("is not held by planLoading / objectives / hydrate once status is known", () => {
    expect(isIleConfirmSettingsBlocked("unknown", false)).toBe(true);
    expect(isIleConfirmSettingsBlocked("exists", false)).toBe(false);
    expect(isIleConfirmSettingsBlocked("empty", false)).toBe(false);
    expect(isIleConfirmSettingsBlocked("failed", false)).toBe(false);
    expect(isIleConfirmSettingsBlocked("exists", true)).toBe(true);

    const blockerSrc = read("components/session-view/ile-confirm-settings.ts");
    expect(blockerSrc).not.toMatch(/planLoading/);
    expect(blockerSrc).toContain('chapterPlanStatus === "unknown"');

    const load = read("components/session-view/use-session-phase.ts");
    const startCheck = load.indexOf(
      "const chapterStatusPromise = fetchWelcomeChapterSnapshot",
    );
    const setFromCheap = load.indexOf(
      "void chapterStatusPromise.then((snapshot) => {",
    );
    const objectives = load.indexOf("/api/generate-objectives");
    expect(startCheck).toBeGreaterThan(-1);
    expect(setFromCheap).toBeGreaterThan(startCheck);
    expect(objectives).toBeGreaterThan(setFromCheap);
  });
});
