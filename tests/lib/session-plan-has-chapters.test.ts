/**
 * Cheap ILE “do chapters already exist?” query.
 * Drives the shipped helper SessionView load/confirm call.
 */
import { describe, expect, it } from "vitest";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  SESSION_PLAN_EMPTY_STEPS_JSON,
  SESSION_PLAN_HAS_CHAPTERS_SELECT,
  sessionPlanHasChapters,
  sessionPlanHasChaptersFromRow,
  sessionPlanHasChaptersQuery,
} from "@/lib/storage/session-plans";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-a94fe582be7f/implementer";

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

describe("sessionPlanHasChapters (shipped existence helper)", () => {
  it("returns true when a plan has steps and false for missing or empty shells", async () => {
    const withChapters = createRecordingClient({
      data: { id: "plan-1" },
      error: null,
    });
    const missing = createRecordingClient({ data: null, error: null });
    const emptyShell = createRecordingClient({
      data: { id: "plan-empty", steps: [] },
      error: null,
    });

    expect(await sessionPlanHasChapters("sess-1", withChapters)).toBe(true);
    expect(await sessionPlanHasChapters("sess-2", missing)).toBe(false);
    expect(await sessionPlanHasChapters("sess-3", emptyShell)).toBe(false);

    expect(sessionPlanHasChaptersFromRow({ id: "plan-1" })).toBe(true);
    expect(sessionPlanHasChaptersFromRow(null)).toBe(false);
    expect(sessionPlanHasChaptersFromRow({ id: "x", steps: [] })).toBe(false);
    expect(
      sessionPlanHasChaptersFromRow({
        id: "x",
        steps: [{ id: "s1", description: "Go" }],
      }),
    ).toBe(true);

    writeScratch(
      "chapter-exists-query.txt",
      [
        `select=${withChapters.recorded.select}`,
        `table=${withChapters.recorded.table}`,
        `hasChapters=${await sessionPlanHasChapters("sess-1", createRecordingClient({ data: { id: "plan-1" }, error: null }))}`,
        `missing=${await sessionPlanHasChapters("sess-2", createRecordingClient({ data: null, error: null }))}`,
        `emptyShell=${await sessionPlanHasChapters("sess-3", createRecordingClient({ data: { id: "e", steps: [] }, error: null }))}`,
      ].join("\n"),
    );
  });

  it("issues an id-only projection and does not select * or the steps array", async () => {
    const client = createRecordingClient({ data: { id: "plan-1" }, error: null });
    await sessionPlanHasChapters("sess-q", client);

    expect(SESSION_PLAN_HAS_CHAPTERS_SELECT).toBe("id");
    expect(SESSION_PLAN_HAS_CHAPTERS_SELECT).not.toContain("*");
    expect(SESSION_PLAN_HAS_CHAPTERS_SELECT).not.toContain("steps");
    expect(client.recorded.table).toBe("session_plans");
    expect(client.recorded.select).toBe(SESSION_PLAN_HAS_CHAPTERS_SELECT);
    expect(client.recorded.select).not.toBe("*");
    expect(client.recorded.select).not.toMatch(/steps/);
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

describe("SessionView / getSessionPlan wiring", () => {
  it("load + confirm use the cheap helper for the boolean; full fetch stays on hydrate/reuse/translate", () => {
    const view = readSessionViewSurface();
    expect(view).toContain("sessionPlanHasChapters");
    expect(view).toContain("getSessionPlan");

    const loadIdx = view.indexOf("const hasChapters = await sessionPlanHasChapters");
    const loadFullIdx = view.indexOf("const existingPlan = await getSessionPlan(s.id)");
    expect(loadIdx).toBeGreaterThan(-1);
    expect(loadFullIdx).toBeGreaterThan(loadIdx);

    const confirmIdx = view.indexOf(
      "const hasExistingChapters = await sessionPlanHasChapters(session.id)",
    );
    expect(confirmIdx).toBeGreaterThan(-1);
    expect(view).toContain("chapterPlanStatus");
    expect(view).toContain("shouldReuseExisting");

    const create = read("app/api/session-plan/create/route.ts");
    expect(create).toContain("getSessionPlan");
    const translate = read("app/api/session-plan/translate/route.ts");
    expect(translate).toContain("getSessionPlan");

    const fullFetch = read("lib/storage/session-plans.ts");
    expect(fullFetch).toContain('.select("*")');
    expect(fullFetch).toContain("sessionPlanHasChapters");
    expect(fullFetch).toContain("SESSION_PLAN_HAS_CHAPTERS_SELECT");

    writeScratch(
      "chapter-exists-excerpts.txt",
      [
        "SessionView load: sessionPlanHasChapters then getSessionPlan if true",
        "SessionView confirm: sessionPlanHasChapters for boolean; getSessionPlan only on EN reuse",
        "create/translate still getSessionPlan for plan body",
        `SESSION_PLAN_HAS_CHAPTERS_SELECT=${SESSION_PLAN_HAS_CHAPTERS_SELECT}`,
      ].join("\n"),
    );
  });
});
