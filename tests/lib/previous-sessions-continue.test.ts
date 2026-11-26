/**
 * Practice previous-sessions list/continue + continue welcome + dummy density maps.
 * Drives shipped helpers, not a reimplementation.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import {
  PREVIOUS_SESSIONS_DRAWER_ID,
  SEE_PREVIOUS_SESSIONS_LABEL,
  START_NEW_SESSION_LABEL,
  WORKSPACE_BLOCK_SESSIONS_PATH,
  WORKSPACE_BLOCKS_WITH_SESSIONS_PATH,
  blockIdsWithSavedPreviousSessions,
  continueIleSessionHref,
  ileLaunchInsertsNewSession,
  listBlockPreviousSessions,
  listWorkspaceBlockIdsWithPreviousSessions,
  normalizeBlockPreviousSessions,
  previousSessionsDrawerShouldLoad,
  workspaceTileShowsPreviousSessionsPickaxe,
} from "@/lib/block-previous-sessions";
import {
  applyIleSessionNameToMetadata,
  applyIleUnsavedExitToMetadata,
  ileSessionListDisplayName,
  ileSessionNameFromMetadata,
  isIleSessionUnsavedExit,
  normalizeIleSessionName,
} from "@/lib/learn-session-name";
import {
  ileUnsavedExitSessionPatch,
  SESSION_PLAN_DISCARD_PATH,
} from "@/lib/learn-unsaved-exit";
import {
  continueMiniCellsFromPlanSteps,
  dummyDensityOccupiedCount,
  ILE_CONTINUE_MAP_PREVIEW_FRAME_CLASS,
  miniMapInteractive,
} from "@/lib/learn-chapter-mini-map";
import { ileWelcomeShowsContinuePreview } from "@/lib/learn-welcome-chapters";
import type { SessionPlanStep } from "@/lib/domain/types";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-f12cef54c820/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function createListClient(input: {
  joins: Array<{ session_id?: string; id?: string; created_at: string }>;
  sessions: Array<{
    id: string;
    created_at: string;
    status: string;
    metadata?: Record<string, unknown>;
  }>;
}) {
  const recorded: { tables: string[]; inIds: string[][] } = {
    tables: [],
    inIds: [],
  };
  return {
    recorded,
    from(table: string) {
      recorded.tables.push(table);
      const self = {
        select() {
          return self;
        },
        eq() {
          return self;
        },
        order() {
          return Promise.resolve({ data: input.joins, error: null });
        },
        in(_col: string, ids: string[]) {
          recorded.inIds.push(ids);
          return Promise.resolve({ data: input.sessions, error: null });
        },
      };
      return self;
    },
  };
}

describe("listBlockPreviousSessions (shipped list entry)", () => {
  it("exposes session id + timestamp from block_sessions + sessions", async () => {
    const client = createListClient({
      joins: [
        { id: "sess-b", created_at: "2026-08-28T05:42:58Z" },
        { id: "sess-a", created_at: "2026-08-28T05:41:57Z" },
      ],
      sessions: [
        { id: "sess-a", created_at: "2026-08-28T05:41:57.000Z", status: "active" },
        { id: "sess-b", created_at: "2026-08-28T05:42:58.000Z", status: "active" },
      ],
    });
    const list = await listBlockPreviousSessions(client, {
      workspaceId: "ws-1",
      blockId: "block-1",
    });
    expect(list).toEqual([
      {
        sessionId: "sess-b",
        startedAt: "2026-08-28T05:42:58.000Z",
        status: "active",
      },
      {
        sessionId: "sess-a",
        startedAt: "2026-08-28T05:41:57.000Z",
        status: "active",
      },
    ]);
    expect(client.recorded.tables[0]).toBe("sessions");
    expect(client.recorded.tables).toContain("sessions");
    expect(list[0].sessionId).toBeTruthy();
    expect(list[0].startedAt).toBeTruthy();
  });

  it("lists learner-chosen names and falls back to session id", async () => {
    expect(normalizeIleSessionName("  Graph walk  ")).toBe("Graph walk");
    expect(normalizeIleSessionName("   ")).toBeNull();
    expect(
      ileSessionListDisplayName({ name: "Graph walk", sessionId: "sess-a" }),
    ).toBe("Graph walk");
    expect(ileSessionListDisplayName({ name: "", sessionId: "sess-a" })).toBe("sess-a");
    expect(
      ileSessionNameFromMetadata({ session_name: "Dijkstra night" }),
    ).toBe("Dijkstra night");
    expect(
      applyIleSessionNameToMetadata(
        { block_id: "b1" } as Record<string, unknown>,
        "  Named  ",
      ).session_name,
    ).toBe("Named");

    const client = createListClient({
      joins: [{ session_id: "sess-named", created_at: "2026-08-28T05:42:58Z" }],
      sessions: [
        {
          id: "sess-named",
          created_at: "2026-08-28T05:42:58.000Z",
          status: "paused",
          metadata: { session_name: "Graph walk" },
        },
      ],
    });
    const list = await listBlockPreviousSessions(client, {
      workspaceId: "ws-1",
      blockId: "block-1",
    });
    expect(list[0]).toMatchObject({
      sessionId: "sess-named",
      name: "Graph walk",
    });
    expect(ileSessionListDisplayName(list[0])).toBe("Graph walk");
  });

  it("omits sessions exited without saving and does not drop Proof of Work", async () => {
    expect(isIleSessionUnsavedExit({ unsaved_exit: true })).toBe(true);
    expect(isIleSessionUnsavedExit({ session_name: "Kept" })).toBe(false);
    expect(
      applyIleUnsavedExitToMetadata({ block_id: "b1" } as Record<string, unknown>)
        .unsaved_exit,
    ).toBe(true);
    expect(ileUnsavedExitSessionPatch({ session_name: "x" }).metadata.unsaved_exit).toBe(
      true,
    );
    expect(SESSION_PLAN_DISCARD_PATH).toBe("/api/session-plan/discard");

    const client = createListClient({
      joins: [
        { session_id: "sess-kept", created_at: "2026-08-28T05:42:58Z" },
        { session_id: "sess-discard", created_at: "2026-08-28T05:43:58Z" },
      ],
      sessions: [
        {
          id: "sess-kept",
          created_at: "2026-08-28T05:42:58.000Z",
          status: "paused",
          metadata: { session_name: "Graph walk" },
        },
        {
          id: "sess-discard",
          created_at: "2026-08-28T05:43:58.000Z",
          status: "paused",
          metadata: { unsaved_exit: true },
        },
      ],
    });
    const list = await listBlockPreviousSessions(client, {
      workspaceId: "ws-1",
      blockId: "block-1",
    });
    expect(list.map((row) => row.sessionId)).toEqual(["sess-kept"]);

    const discardRoute = read("app/api/session-plan/discard/route.ts");
    expect(discardRoute).toContain("deleteSessionPlanBySessionId");
    expect(discardRoute).toContain("ileUnsavedExitSessionPatch");
    expect(discardRoute).toContain("guardSessionRoute");
    expect(discardRoute).not.toMatch(/\.from\(\s*["']proof_of_work["']\s*\)/);
    expect(discardRoute).toContain("proof_of_work");
  });

  it("normalize keeps id + timestamp and drops empties", () => {
    expect(
      normalizeBlockPreviousSessions([
        { session_id: "s1", created_at: "2026-01-01T00:00:00Z" },
        { sessionId: "", startedAt: "x" },
      ]),
    ).toEqual([{ sessionId: "s1", startedAt: "2026-01-01T00:00:00Z" }]);
  });
});

describe("welcome branch continue vs new", () => {
  it("continue preview uses stored plan; Learn start has no size picker", () => {
    expect(ileWelcomeShowsContinuePreview("exists")).toBe(true);
    expect(ileWelcomeShowsContinuePreview("empty")).toBe(false);
    expect(ileWelcomeShowsContinuePreview("empty", { resume: true })).toBe(true);
    expect(ileWelcomeShowsContinuePreview("unknown", { stepCount: 2 })).toBe(
      true,
    );
    const page = read("app/session/page.tsx");
    expect(page).toContain("isIleResumeQuery");
    expect(page).toContain("resumeSession");

    const welcome = read("components/session-view/session-welcome-modal.tsx");
    expect(welcome).not.toContain("ileWelcomeShowsSizePicker");
    expect(welcome).toContain("resumeSession");
    expect(welcome).not.toContain("ileWelcomeShowsContinuePreview");
    expect(welcome).not.toContain("ileWelcomeShowsRegenerate");
    expect(welcome).not.toContain("data-ile-continue-welcome");
    expect(welcome).not.toContain("IleContinueMapPreview");
    expect(welcome).not.toContain("InitialChaptersPicker");
    expect(welcome).not.toContain("data-ile-session-chapter-count");
    expect(welcome).not.toContain("data-ile-session-insight-goal");
    expect(welcome).not.toContain("data-ile-silence-lock-minutes");
    expect(welcome).not.toContain("capIleSessionChapters");
    const picker = read("components/InitialChaptersPicker.tsx");
    expect(picker).toContain("data-density-level");
    expect(picker).toContain("INITIAL_CHAPTERS_CATALOG");
    expect(picker).toContain("data-initial-chapters-prev");
    expect(picker).toContain("data-initial-chapters-next");
    expect(picker).toContain("data-initial-chapters-random-pick");
    expect(picker).not.toContain('type="checkbox"');
    expect(picker).toContain("pickRandomMapType");
    expect(welcome).not.toContain("catalogStrip");
    expect(welcome).not.toContain('data-ile-map-type-align="aesthetics"');
  });
});

describe("dummy density occupancy + continue mini read-only", () => {
  it("random sparse is sparser than random dense, and dummy maps are not session_plans", () => {
    const n = dummyDensityOccupiedCount("random_sparse");
    const b = dummyDensityOccupiedCount("random_dense");
    expect(n).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(n);

    const miniLib = read("lib/learn-chapter-mini-map.ts");
    expect(miniLib).toContain("Dummy occupancy");
    expect(miniLib).not.toMatch(/from\(\"session_plans\"\)/);
    expect(miniLib).toContain("DUMMY_DENSITY_CELLS");

    const welcome = read("components/session-view/session-welcome-modal.tsx");
    expect(welcome).not.toContain("InitialChaptersPicker");
    expect(welcome).not.toContain("data-ile-continue-chapter-count");
    const picker = read("components/InitialChaptersPicker.tsx");
    expect(picker).toContain("dummyDensityCells");
    expect(picker).toContain("dummy");
    const miniUi = read("components/ChapterMiniMap.tsx");
    expect(miniUi).toContain('data-mini-cell={cellKind}');
    expect(miniUi).toContain('"blocked"');
  });

  it("continue mini is built from stored plan steps and is not interactive", () => {
    expect(miniMapInteractive()).toBe(false);
    const steps: SessionPlanStep[] = [
      {
        id: "a",
        description: "One",
        status: "completed",
        type: "task",
        order: 0,
        position_x: 0,
        position_y: 0,
      },
      {
        id: "b",
        description: "Two",
        status: "pending",
        type: "task",
        order: 1,
        position_x: 1,
        position_y: 0,
      },
    ];
    const cells = continueMiniCellsFromPlanSteps(steps);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.some((c) => c.row === 0 && c.col === 0)).toBe(true);
    expect(cells.some((c) => c.status === "completed")).toBe(true);

    const mini = read("components/ChapterMiniMap.tsx");
    expect(mini).toContain("pointer-events-none");
    expect(mini).toContain('data-chapter-mini-interactive={interactive ? "true" : "false"}');
    expect(mini).not.toMatch(/onClick/);
    expect(mini).not.toMatch(/onLoadChapter|handleLoadChapter/);

    const welcome = read("components/session-view/session-welcome-modal.tsx");
    expect(welcome).not.toContain("IleContinueMapPreview");
    expect(welcome).not.toContain("data-ile-continue-welcome");
    expect(welcome).not.toContain("capIleSessionChapters");
    expect(
      existsSync(join(ROOT, "components/session-view/learn-continue-map-preview.tsx")),
    ).toBe(false);
    expect(ILE_CONTINUE_MAP_PREVIEW_FRAME_CLASS).toContain("h-full");
    expect(ILE_CONTINUE_MAP_PREVIEW_FRAME_CLASS).toContain(
      "max-lg:min-h-[min(14rem,28vh)]",
    );
    expect(ILE_CONTINUE_MAP_PREVIEW_FRAME_CLASS).not.toContain("28rem");
    expect(welcome).not.toContain("ile-pregame-panel-map");
    expect(welcome).not.toContain('data-ile-continue-map-align="aesthetics"');
    expect(welcome).toContain("data-ile-session-chapters");
    expect(welcome).not.toContain("data-ile-session-chapter-count");
    expect(welcome).not.toContain("data-ile-session-insight-goal");
    expect(welcome).not.toContain("data-ile-silence-lock-minutes");
    expect(welcome).toContain("flex-1");
    expect(existsSync(join(ROOT, "components/AyclLandingClient.tsx"))).toBe(false);
  });
});
