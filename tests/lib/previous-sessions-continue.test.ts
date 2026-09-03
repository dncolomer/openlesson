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
} from "@/lib/ile-session-name";
import {
  ileUnsavedExitSessionPatch,
  SESSION_PLAN_DISCARD_PATH,
} from "@/lib/ile-unsaved-exit";
import {
  continueMiniCellsFromPlanSteps,
  dummyDensityOccupiedCount,
  ILE_CONTINUE_MAP_PREVIEW_FRAME_CLASS,
  miniMapInteractive,
} from "@/lib/ile-chapter-mini-map";
import {
  ileWelcomeShowsContinuePreview,
  ileWelcomeShowsRegenerate,
  ileWelcomeShowsSizePicker,
} from "@/lib/ile-welcome-chapters";
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
  joins: Array<{ session_id: string; created_at: string }>;
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
        { session_id: "sess-b", created_at: "2026-08-28T05:42:58Z" },
        { session_id: "sess-a", created_at: "2026-08-28T05:41:57Z" },
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
    expect(client.recorded.tables[0]).toBe("block_sessions");
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
    expect(discardRoute).not.toMatch(/\.from\(\s*["']workspace_proof_of_work["']\s*\)/);
    expect(discardRoute).toContain("workspace_proof_of_work");
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

describe("continue uses chosen session id and does not insert", () => {
  it("continue href is the existing session id; continue does not insert", () => {
    expect(continueIleSessionHref("49f92e9d-1f5c-4191-ac11-85b61bc65e72")).toBe(
      "/session?id=49f92e9d-1f5c-4191-ac11-85b61bc65e72&resume=1",
    );
    expect(ileLaunchInsertsNewSession("continue")).toBe(false);
    expect(ileLaunchInsertsNewSession("new")).toBe(true);

    const pane = read("components/WorkspaceLearnerBlockPane.tsx");
    expect(pane).toContain("ileSessionListDisplayName");
    expect(pane).toContain("data-previous-session-name");
    expect(pane).toContain("continueIleSessionHref");
    expect(pane).toContain("ileLaunchInsertsNewSession(\"continue\")");
    expect(pane).toContain("WORKSPACE_LEARNER_LAUNCH_PATH".slice(0, 0) + "onLaunchIntent");
    expect(pane).not.toMatch(
      /continueSession[\s\S]{0,400}WORKSPACE_LEARNER_LAUNCH_PATH/,
    );
    const continueFn = pane.indexOf("const continueSession");
    const launchPath = pane.indexOf("WORKSPACE_LEARNER_LAUNCH_PATH");
    const hrefCall = pane.indexOf("continueIleSessionHref(sessionId)");
    expect(continueFn).toBeGreaterThan(-1);
    expect(hrefCall).toBeGreaterThan(continueFn);
    expect(pane.slice(continueFn, hrefCall + 80)).not.toContain("learner-launch");
  });
});

describe("welcome branch continue vs new", () => {
  it("continue hides regenerate + size picker; new shows three density buttons", () => {
    expect(ileWelcomeShowsSizePicker("empty")).toBe(true);
    expect(ileWelcomeShowsSizePicker("exists")).toBe(false);
    expect(ileWelcomeShowsSizePicker("empty", { resume: true })).toBe(false);
    expect(ileWelcomeShowsSizePicker("unknown", { resume: true })).toBe(false);
    expect(ileWelcomeShowsSizePicker("empty", { stepCount: 13 })).toBe(false);
    expect(ileWelcomeShowsContinuePreview("exists")).toBe(true);
    expect(ileWelcomeShowsContinuePreview("empty")).toBe(false);
    expect(ileWelcomeShowsContinuePreview("empty", { resume: true })).toBe(true);
    expect(ileWelcomeShowsContinuePreview("unknown", { stepCount: 2 })).toBe(
      true,
    );
    expect(ileWelcomeShowsRegenerate("exists")).toBe(false);
    expect(ileWelcomeShowsRegenerate("empty")).toBe(false);

    const page = read("app/session/page.tsx");
    expect(page).toContain("isIleResumeQuery");
    expect(page).toContain("resumeSession");

    const welcome = read("components/session-view/session-welcome-modal.tsx");
    expect(welcome).toContain("ileWelcomeShowsSizePicker");
    expect(welcome).toContain("resumeSession");
    expect(welcome).toContain("welcomeExtras");
    expect(welcome).toContain("ileWelcomeShowsContinuePreview");
    expect(welcome).toContain("ileWelcomeShowsRegenerate");
    expect(welcome).toContain("data-ile-continue-welcome");
    expect(welcome).toContain("IleContinueMapPreview");
    expect(welcome).toContain("InitialChaptersPicker");
    const picker = read("components/InitialChaptersPicker.tsx");
    expect(picker).toContain("data-density-level");
    expect(picker).toContain("INITIAL_CHAPTERS_CATALOG");
    expect(picker).toContain("data-initial-chapters-prev");
    expect(picker).toContain("data-initial-chapters-next");
    const continueAt = welcome.indexOf("data-ile-continue-welcome");
    const sizeAt = welcome.indexOf("showSizePicker");
    expect(continueAt).toBeGreaterThan(-1);
    expect(sizeAt).toBeGreaterThan(-1);
  });
});

describe("dummy density occupancy + continue mini read-only", () => {
  it("random sparse is sparser than random dense, and dummy maps are not session_plans", () => {
    const n = dummyDensityOccupiedCount("random_sparse");
    const b = dummyDensityOccupiedCount("random_dense");
    expect(n).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(n);

    const miniLib = read("lib/ile-chapter-mini-map.ts");
    expect(miniLib).toContain("Dummy occupancy");
    expect(miniLib).not.toMatch(/from\(\"session_plans\"\)/);
    expect(miniLib).toContain("DUMMY_DENSITY_CELLS");

    const welcome = read("components/session-view/session-welcome-modal.tsx");
    expect(welcome).toContain("InitialChaptersPicker");
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
    expect(welcome).toContain("IleContinueMapPreview");
    expect(welcome).toContain("sessionPlan?.steps");
    const preview = read("components/session-view/ile-continue-map-preview.tsx");
    expect(preview).toContain("BlockSkillGrid");
    expect(preview).toContain("viewOnly");
    expect(preview).toContain("showMinimap={false}");
    expect(preview).toContain("learnerMode");
    expect(preview).toContain("canEdit={false}");
    expect(preview).toContain("sessionStepsToSkillGridNodes");
    expect(preview).toContain("ILE_CONTINUE_MAP_PREVIEW_FRAME_CLASS");
    expect(ILE_CONTINUE_MAP_PREVIEW_FRAME_CLASS).toContain("h-full");
    expect(ILE_CONTINUE_MAP_PREVIEW_FRAME_CLASS).toContain(
      "max-lg:min-h-[min(14rem,28vh)]",
    );
    expect(ILE_CONTINUE_MAP_PREVIEW_FRAME_CLASS).not.toContain("28rem");
    expect(welcome).toContain('lg:items-stretch');
    expect(welcome).toContain('data-ile-continue-map-align="aesthetics"');
    expect(welcome).toContain("flex-1");
    expect(welcome).toContain("pb-0");
    const aycl = read("components/AyclLandingClient.tsx");
    expect(aycl).toContain("h-[min(28rem,55vh)]");
    expect(aycl).toContain("viewOnly");
    expect(preview).toContain("data-ile-continue-mini-map");
    expect(preview).not.toContain("sessionId=");
    expect(preview).not.toContain("suggestMode=");
    expect(preview).not.toContain("ileContinueMapOverlayInput");
  });
});

describe("Practice drawer labels and previous-sessions UI", () => {
  it("uses verbatim See Previous Sessions and Start a New Session", async () => {
    const pane = read("components/WorkspaceLearnerBlockPane.tsx");
    expect(SEE_PREVIOUS_SESSIONS_LABEL).toBe("See Previous Sessions");
    expect(START_NEW_SESSION_LABEL).toBe("Start a New Session");
    expect(pane).toContain("SEE_PREVIOUS_SESSIONS_LABEL");
    expect(pane).toContain("START_NEW_SESSION_LABEL");
    expect(pane).toContain("drawerId={PREVIOUS_SESSIONS_DRAWER_ID}");
    expect(pane).toContain("previousSessionsDrawerShouldLoad(openDrawerId)");
    expect(pane).toContain("fetchBlockPreviousSessions");
    expect(previousSessionsDrawerShouldLoad(PREVIOUS_SESSIONS_DRAWER_ID)).toBe(
      true,
    );
    expect(previousSessionsDrawerShouldLoad("practice")).toBe(false);
    expect(previousSessionsDrawerShouldLoad(null)).toBe(false);
    const loadEffect = pane.indexOf("previousSessionsDrawerShouldLoad(openDrawerId)");
    const fetchAt = pane.indexOf("fetchBlockPreviousSessions", loadEffect);
    const buttonOpen = pane.indexOf(
      "setOpenDrawerId(PREVIOUS_SESSIONS_DRAWER_ID)",
    );
    expect(loadEffect).toBeGreaterThan(-1);
    expect(fetchAt).toBeGreaterThan(loadEffect);
    expect(buttonOpen).toBeGreaterThan(-1);
    expect(pane.slice(buttonOpen, buttonOpen + 120)).not.toContain(
      "fetchBlockPreviousSessions",
    );
    expect(pane).toContain("data-previous-session-row");
    expect(pane).toContain("data-previous-session-name");
    expect(pane).toContain("ileSessionListDisplayName");
    expect(pane).toContain("data-continue-session");
    expect(pane).toContain("entry.sessionId");
    expect(pane).toContain("entry.startedAt");

    const card = read("components/BlockDetailCard.tsx");
    expect(card).toContain("data-see-previous-sessions");
    expect(card).toContain("ileStartLabel");
    expect(card).toContain("`Start · ${durationMinutes} min`");

    const route = read("app/api/workspace/block-sessions/route.ts");
    expect(route).toContain("listBlockPreviousSessions");
    expect(route).toContain("guardWorkspaceRoute");
    expect(WORKSPACE_BLOCK_SESSIONS_PATH).toBe("/api/workspace/block-sessions");
    expect(WORKSPACE_BLOCKS_WITH_SESSIONS_PATH).toBe(
      "/api/workspace/blocks-with-sessions",
    );

    expect(
      blockIdsWithSavedPreviousSessions(
        [
          { block_id: "b-saved", session_id: "s-saved" },
          { block_id: "b-discard", session_id: "s-discard" },
          { block_id: "b-saved", session_id: "s-other" },
        ],
        [
          { id: "s-saved", metadata: { session_name: "Keep" } },
          { id: "s-discard", metadata: { unsaved_exit: true } },
          { id: "s-other", metadata: { unsaved_exit: true } },
        ],
      ),
    ).toEqual(["b-saved"]);
    expect(
      workspaceTileShowsPreviousSessionsPickaxe({
        suggestMode: "block",
        blockId: "b-saved",
        previousSessionBlockIds: new Set(["b-saved"]),
      }),
    ).toBe(true);
    expect(
      workspaceTileShowsPreviousSessionsPickaxe({
        suggestMode: "chapter",
        blockId: "b-saved",
        previousSessionBlockIds: new Set(["b-saved"]),
      }),
    ).toBe(false);

    const mapClient = {
      from(table: string) {
        if (table === "block_sessions") {
          const q = {
            select() {
              return q;
            },
            eq() {
              return Promise.resolve({
                data: [
                  { block_id: "b-saved", session_id: "s-saved" },
                  { block_id: "b-discard", session_id: "s-discard" },
                ],
                error: null,
              });
            },
          };
          return q;
        }
        const q = {
          select() {
            return q;
          },
          in() {
            return Promise.resolve({
              data: [
                { id: "s-saved", metadata: { session_name: "Keep" } },
                { id: "s-discard", metadata: { unsaved_exit: true } },
              ],
              error: null,
            });
          },
        };
        return q;
      },
    };
    await expect(
      listWorkspaceBlockIdsWithPreviousSessions(mapClient, {
        workspaceId: "ws-1",
      }),
    ).resolves.toEqual(["b-saved"]);

    const grid = read("components/BlockSkillGrid.tsx");
    const world = read("components/block-skill-grid/map-world-layer.tsx");
    const badges = read("components/block-skill-grid/map-tile-badges.tsx");
    const mapRoute = read("app/api/workspace/blocks-with-sessions/route.ts");
    expect(grid).toContain("useWorkspacePreviousSessionBlockIds");
    expect(grid).toContain("previousSessionBlockIds");
    expect(world).toContain("BlockPreviousSessionsPickaxeBadge");
    expect(world).toContain("data-block-has-previous-sessions");
    expect(badges).toContain("data-block-previous-sessions-pickaxe");
    expect(badges).not.toMatch(/from "lucide-react"/);
    expect(mapRoute).toContain("listWorkspaceBlockIdsWithPreviousSessions");
    expect(mapRoute).toContain("guardWorkspaceRoute");

    const view = readSessionViewSurface();
    expect(view).toContain("ileWelcomeShowsSizePicker");
    expect(view).toContain("ileWelcomeShowsRegenerate");
    const chrome = read("components/session-view/session-chrome.tsx");
    const phase = read("components/session-view/use-session-phase.ts");
    expect(chrome).toContain('testId="ile-save-exit-name"');
    expect(chrome).toContain("data-ile-session-name");
    expect(chrome).toContain('t("session.nameSessionTitle")');
    expect(chrome).toContain('t("session.nameSessionDiscard")');
    expect(chrome).toContain('t("session.nameSessionBody")');
    expect(chrome).toContain('tertiaryTestId="ile-exit-without-saving"');
    expect(view).toContain("setShowSaveExitNameDialog(true)");
    expect(view).toContain("pauseAndGoToDashboard(saveExitName)");
    expect(view).toContain("persistSession: false");
    expect(phase).toContain("applyIleSessionNameToMetadata");
    expect(phase).toContain("discardUnsavedIleSession");
    expect(phase).toContain("async (");
    expect(phase).toContain("persistSession");

    const en = JSON.parse(read("messages/en.json")) as {
      session: Record<string, string>;
    };
    expect(en.session.nameSessionBody).toMatch(/Proof of Work/i);
    expect(en.session.nameSessionBody).toMatch(/map will be lost/i);
    expect(en.session.nameSessionDiscard).toMatch(/without saving/i);

    writeScratch(
      "previous-sessions-excerpts.txt",
      [
        `SEE_PREVIOUS_SESSIONS_LABEL=${SEE_PREVIOUS_SESSIONS_LABEL}`,
        `START_NEW_SESSION_LABEL=${START_NEW_SESSION_LABEL}`,
        `continueHref=${continueIleSessionHref("sess-1")}`,
        `insertContinue=${ileLaunchInsertsNewSession("continue")}`,
        `insertNew=${ileLaunchInsertsNewSession("new")}`,
        `sizePickerExists=${ileWelcomeShowsSizePicker("exists")}`,
        `sizePickerEmpty=${ileWelcomeShowsSizePicker("empty")}`,
        `dummySparse=${dummyDensityOccupiedCount("random_sparse")}`,
        `dummyDense=${dummyDensityOccupiedCount("random_dense")}`,
        `dummyIslands=${dummyDensityOccupiedCount("islands")}`,
        `miniInteractive=${miniMapInteractive()}`,
      ].join("\n"),
    );
  });
});
