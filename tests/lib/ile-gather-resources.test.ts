/**
 * ILE Gather resources: decide/consume/rate-limit, forage input, PoW record,
 * under-layer progress, block-scoped planned resources, Chapter widget surface.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import {
  applyIleGatherSpend,
  availableIlePowCounts,
  buildIleGatherForageInput,
  buildIleGatherPowArtifact,
  completeIleGatherJob,
  computeIleGatherConsume,
  createIleGatherJob,
  decideIleGatherResources,
  describeIleGatherForagePolicy,
  filterPlannedResourcesForIleBlock,
  formatIleGatherInsufficientWarning,
  ileGatherFinishOpensTool,
  ileGatherForageUserPrompt,
  ileGatherJobShowsFinishLink,
  ileGatherProgressFraction,
  ileGatherResourceMeta,
  ILE_GATHER_CONSUME,
  ILE_GATHER_FORAGE_POLICY,
  ILE_GATHER_INSUFFICIENT_POW_WARNING,
  ILE_GATHER_MAX_PER_SESSION,
  ILE_GATHER_MIN_TOTAL,
  ILE_GATHER_RATE_LIMIT_MS,
  ILE_GATHER_RATE_LIMIT_WARNING,
  ILE_GATHER_RESOURCES_TOOL,
  ILE_GATHER_SESSION_PERSIST_SELECT,
  isIleGatherResource,
  mergeIleGatherPlannedResources,
  parseIleGatherForageResponse,
  refundIleGatherSpend,
  resolveIleGatherPersistWorkspaceId,
  toIleGatherExternalCreate,
  type IleGatherJob,
} from "@/lib/ile-gather-resources";
import {
  countIlePowByType,
  emptyIlePowTypeCounts,
  type IlePowCounterArtifact,
} from "@/lib/ile-pow-counters";
import type { WorkspaceExternalResource } from "@/lib/workspace-external-resources";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-c4bc4e763ac7/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function enoughArtifacts(): IlePowCounterArtifact[] {
  return [
    { type: "tool", tool_name: "notebook" },
    { type: "tool", tool_name: "canvas" },
    { type: "screen" },
  ];
}

describe("ILE gather resources", () => {
  it("refuses insufficient PoW and rate-limit; consumes typed amounts when allowed", () => {
    const empty = decideIleGatherResources({ artifacts: [] });
    expect(empty.allowed).toBe(false);
    expect(empty.reason).toBe("insufficient_pow");
    expect(empty.warning).toBe(
      formatIleGatherInsufficientWarning({ reason: "insufficient_pow" }),
    );
    expect(empty.warning).toBe(ILE_GATHER_INSUFFICIENT_POW_WARNING);
    expect(empty.warning).toMatch(/work more PoW/i);
    expect(empty.warning).toMatch(/forage manually inside the chapter tool/i);
    expect(empty.consume).toEqual(emptyIlePowTypeCounts());

    const twoTools = decideIleGatherResources({
      artifacts: [{ type: "tool" }, { type: "tool" }],
    });
    expect(countIlePowByType([{ type: "tool" }, { type: "tool" }]).tool).toBe(2);
    expect(twoTools.allowed).toBe(false);
    expect(ilePowTotalFromDecision(twoTools.available)).toBeLessThan(ILE_GATHER_MIN_TOTAL);

    const videoZero = decideIleGatherResources({
      artifacts: enoughArtifacts(),
    });
    expect(videoZero.available.video).toBe(0);
    expect(videoZero.allowed).toBe(true);
    expect(videoZero.reason).toBe("ok");
    expect(videoZero.warning).toBeNull();
    expect(videoZero.consume.tool).toBe(ILE_GATHER_CONSUME.tool);
    expect(videoZero.consume.screen).toBe(1);
    expect(videoZero.consume.video).toBe(0);

    const spent = applyIleGatherSpend(emptyIlePowTypeCounts(), videoZero.consume);
    expect(spent.tool).toBe(2);
    expect(spent.screen).toBe(1);
    const afterSpend = decideIleGatherResources({
      artifacts: enoughArtifacts(),
      spent,
    });
    expect(afterSpend.allowed).toBe(false);
    expect(afterSpend.reason).toBe("insufficient_pow");
    const refunded = refundIleGatherSpend(spent, videoZero.consume);
    expect(refunded).toEqual(emptyIlePowTypeCounts());
    expect(
      availableIlePowCounts(countIlePowByType(enoughArtifacts()), spent).tool,
    ).toBe(0);

    const rate = decideIleGatherResources({
      artifacts: enoughArtifacts(),
      lastGatherAt: 1_000,
      gatherCount: 1,
      now: 1_000 + ILE_GATHER_RATE_LIMIT_MS - 1,
    });
    expect(rate.allowed).toBe(false);
    expect(rate.reason).toBe("rate_limited");
    expect(rate.warning).toBe(ILE_GATHER_RATE_LIMIT_WARNING);
    expect(rate.warning).toMatch(/forage manually inside the chapter tool/i);

    const maxed = decideIleGatherResources({
      artifacts: enoughArtifacts(),
      gatherCount: ILE_GATHER_MAX_PER_SESSION,
      now: 9_999_999,
    });
    expect(maxed.allowed).toBe(false);
    expect(maxed.reason).toBe("rate_limited");

    const consumeDirect = computeIleGatherConsume({
      tool: 5,
      screen: 0,
      video: 0,
      eeg: 4,
    });
    expect(consumeDirect.tool).toBe(2);
    expect(consumeDirect.eeg).toBe(1);
    expect(consumeDirect.screen).toBe(0);

    writeScratch(
      "ile-gather-decide.txt",
      JSON.stringify({ empty, videoZero, spent, rate, consumeDirect }),
    );
  });

  it("forage input uses current PoW plus modifier as edge-of-work epistemic forage; gather is PoW", () => {
    const artifacts = enoughArtifacts();
    const forage = buildIleGatherForageInput({
      artifacts,
      promptModifier: "prefer primary sources",
      chapter: { id: "ch-1", description: "Limits" },
      blockId: "block-9",
    });
    expect(forage.blockId).toBe("block-9");
    expect(forage.chapterId).toBe("ch-1");
    expect(forage.promptModifier).toBe("prefer primary sources");
    expect(forage.powCounts).toEqual(countIlePowByType(artifacts));
    expect(forage.powBaseline.length).toBeGreaterThan(0);
    expect(forage.policy).toBe(describeIleGatherForagePolicy());
    expect(forage.policy).toBe(ILE_GATHER_FORAGE_POLICY);
    expect(forage.policy).toMatch(/epistemic/i);
    expect(forage.policy).toMatch(/edge of current work/i);
    expect(forage.policy).toMatch(/uncertainty/i);
    expect(forage.policy).toMatch(/rather than chasing scores/);

    const user = ileGatherForageUserPrompt(forage);
    expect(user).toContain("prefer primary sources");
    expect(user).toContain("Limits");
    expect(user).toContain("tool=2");
    expect(user).toMatch(/edge of this work/i);
    expect(user).toContain(forage.policy);

    const parsed = parseIleGatherForageResponse({
      resources: [
        {
          title: "Edge note",
          url: "https://example.com/limits-beyond",
          description: "Adjacent",
          why_edge: "extends the current chapter",
        },
        { title: "bad", url: "not-a-url" },
      ],
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0].url).toContain("https://");
    const meta = ileGatherResourceMeta({
      blockId: "block-9",
      jobId: "ile-gather-1",
      chapterId: "ch-1",
    });
    const create = toIleGatherExternalCreate(parsed[0], meta);
    expect(create).not.toBeNull();
    expect(create?.meta).toMatchObject({ ile_gather: true, block_id: "block-9" });
    expect(isIleGatherResource({ meta, resource_type: "ile_gather" })).toBe(true);

    const pow = buildIleGatherPowArtifact({
      jobId: "ile-gather-1",
      blockId: "block-9",
      chapterId: "ch-1",
      consume: ILE_GATHER_CONSUME,
    });
    expect(pow.type).toBe("tool");
    expect(pow.tool_name).toBe("gather-resources");
    expect(pow.tool_action).toBe("epistemic-forage");
    expect(countIlePowByType([pow]).tool).toBe(1);

    writeScratch(
      "ile-gather-forage.txt",
      JSON.stringify({ forage, parsed, pow }),
    );
  });

  it("finished job exposes a resources-tool link; results are block-scoped", () => {
    let jobs: IleGatherJob[] = [
      createIleGatherJob({ id: "ile-gather-1", blockId: "block-9" }),
    ];
    expect(jobs[0].status).toBe("running");
    expect(ileGatherProgressFraction(jobs[0])).toBe(0);
    expect(ileGatherJobShowsFinishLink(jobs[0])).toBe(false);
    jobs = completeIleGatherJob(jobs, "ile-gather-1");
    expect(jobs[0].status).toBe("completed");
    expect(ileGatherProgressFraction(jobs[0])).toBe(1);
    expect(jobs[0].openTool).toBe(ileGatherFinishOpensTool());
    expect(jobs[0].openTool).toBe(ILE_GATHER_RESOURCES_TOOL);
    expect(ileGatherJobShowsFinishLink(jobs[0])).toBe(true);

    const a: WorkspaceExternalResource = {
      id: "r1",
      workspace_id: "ws",
      title: "A",
      url: "https://example.com/a",
      resource_type: "ile_gather",
      description: null,
      source: "link",
      dantes_topic_slug: null,
      meta: { ile_gather: true, block_id: "block-9" },
      sort_order: 0,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const b: WorkspaceExternalResource = {
      ...a,
      id: "r2",
      title: "B",
      url: "https://example.com/b",
      meta: { ile_gather: true, block_id: "other" },
    };
    const scoped = filterPlannedResourcesForIleBlock([a, b], "block-9");
    expect(scoped.map((r) => r.id)).toEqual(["r1"]);
    const workspaceAll = filterPlannedResourcesForIleBlock([a, b], null);
    expect(workspaceAll).toHaveLength(2);
    const merged = mergeIleGatherPlannedResources({
      fetched: [b],
      local: [a],
      blockId: "block-9",
    });
    expect(merged.map((r) => r.id)).toEqual(["r1"]);

    writeScratch(
      "ile-gather-finish.txt",
      JSON.stringify({ job: jobs[0], scoped: scoped.map((r) => r.id) }),
    );
  });

  it("persist workspace id comes from session metadata (or body), never a sessions.workspace_id column", () => {
    const columnOnly = resolveIleGatherPersistWorkspaceId({
      sessionRow: {
        metadata: {},
        workspace_id: "column-ws",
      } as { metadata?: unknown },
    });
    expect(columnOnly).toBe("");

    const fromMeta = resolveIleGatherPersistWorkspaceId({
      sessionRow: {
        metadata: { workspace_id: "meta-ws" },
        workspace_id: "column-ws",
      } as { metadata?: unknown },
    });
    expect(fromMeta).toBe("meta-ws");
    expect(fromMeta).not.toBe("column-ws");

    const fromCamel = resolveIleGatherPersistWorkspaceId({
      sessionRow: { metadata: { workspaceId: "camel-ws" } },
    });
    expect(fromCamel).toBe("camel-ws");

    const fromBody = resolveIleGatherPersistWorkspaceId({
      sessionRow: { metadata: {} },
      bodyWorkspaceId: "body-ws",
    });
    expect(fromBody).toBe("body-ws");

    expect(ILE_GATHER_SESSION_PERSIST_SELECT).toBe("id, metadata");
    expect(ILE_GATHER_SESSION_PERSIST_SELECT).not.toMatch(/workspace_id/);

    const api = read("app/api/ile/gather-resources/route.ts");
    expect(api).toContain("let persisted: WorkspaceExternalResource[] = []");
    expect(api).toContain("resolveIleGatherPersistWorkspaceId");
    expect(api).toContain("ILE_GATHER_SESSION_PERSIST_SELECT");
    expect(api).toContain(".select(ILE_GATHER_SESSION_PERSIST_SELECT)");
    expect(api).not.toContain('.select("id, workspace_id")');
    expect(api).not.toMatch(/session\?\.workspace_id/);
    expect(api).toContain("workspace_external_resources");
    const hook = read("components/session-view/use-ile-gather-resources.ts");
    expect(hook).toContain("workspaceId: input.workspaceId");

    writeScratch(
      "ile-gather-persist-workspace.txt",
      JSON.stringify({
        columnOnly,
        fromMeta,
        fromCamel,
        fromBody,
        select: ILE_GATHER_SESSION_PERSIST_SELECT,
      }),
    );
  });

  it("Chapter widget surfaces Gather with Edit, Complete, Done Answering; ILE shows under-layer progress and finish link", () => {
    const surface = readSessionViewSurface();
    const actions = read("components/session-view/ile-chapter-helios-actions.tsx");
    const helios = read("components/SessionHeliosPanel.tsx");
    const chapter = read("components/ChapterMapPanel.tsx");
    const grid = read("components/BlockSkillGrid.tsx");
    const jobs = read("components/block-skill-grid/map-job-indicators.tsx");
    const panes = read("components/session-view/session-tool-panes.tsx");
    const panel = read("components/WorkspaceResourcesPanel.tsx");
    const api = read("app/api/ile/gather-resources/route.ts");

    expect(actions).toContain("data-ile-gather-resources");
    expect(actions).not.toContain("data-ile-gather-prompt");
    expect(actions).not.toContain("gatherPromptPlaceholder");
    expect(actions).toContain("data-ile-gather-warning");
    expect(actions).toContain("data-ile-gather-warning-dismiss");
    expect(actions).toContain('t("chapterMap.gatherInsufficientTitle")');
    expect(actions).not.toContain("ConfirmDialog");
    expect(actions).not.toContain("hideCancel");
    expect(actions).toContain('t("chapterMap.edit")');
    expect(actions).toContain('t("chapterMap.complete")');
    expect(actions).toContain('t("chapterMap.gatherResources")');
    expect(actions).toContain("<Pencil");
    expect(actions).toContain("<Check");
    expect(actions).toContain("<Pickaxe");
    expect(actions).toContain("data-ile-chapter-actions");
    expect(actions).toContain("doneAnswering");
    expect(helios).toContain("ImDoneAnsweringControl");
    expect(helios).toContain("IleChapterHeliosActions");
    expect(helios).toContain("doneAnswering");
    expect(surface).toContain("chapterActions");
    expect(surface).toContain("gatherJobs");
    expect(surface).toContain("onGatherResources");
    expect(surface).toContain("decideIleGatherResources");
    expect(surface).toContain("formatIleGatherInsufficientWarning");

    const editIdx = actions.indexOf('t("chapterMap.edit")');
    const completeIdx = actions.indexOf('t("chapterMap.complete")');
    const gatherIdx = actions.indexOf('t("chapterMap.gatherResources")');
    expect(editIdx).toBeGreaterThan(-1);
    expect(completeIdx).toBeGreaterThan(editIdx);
    expect(gatherIdx).toBeGreaterThan(completeIdx);

    expect(jobs).toContain("data-ile-gather-progress");
    expect(jobs).toContain("data-ile-gather-progress-bar");
    expect(jobs).toContain("data-ile-gather-open-resources");
    expect(jobs).toContain("ileGatherJobShowsFinishLink");
    expect(jobs).toContain("gatherJobs");
    expect(chapter).toContain("gatherJobs");
    expect(grid).toContain("gatherJobs");
    expect(jobs).toContain("ILE_GATHER_RESOURCES_TOOL");

    expect(api).toContain("callXaiJSON");
    expect(api).toContain("buildIleGatherForageInput");
    expect(api).toContain("ileGatherForageSystemPrompt");
    expect(api).toContain("workspace_external_resources");
    expect(api).toContain("ileGatherResourceMeta");

    expect(panes).toContain("WorkspaceResourcesPanel");
    expect(panes).toContain("blockId");
    expect(panel).toContain("filterPlannedResourcesForIleBlock");
    expect(panel).toContain("mergeIleGatherPlannedResources");
    expect(panel).toContain("data-ile-gather-planned");

    expect(surface).toContain("availableIlePowCounts");
    expect(surface).toContain("applyIleGatherSpend");
    expect(surface).toContain("buildIleGatherPowArtifact");
    expect(surface).toContain('setActiveTool("plan-resources")');
    expect(surface).toContain("onOpenResources");

    writeScratch(
      "ile-gather-surface.txt",
      [
        "gather=data-ile-gather-resources",
        "progress=data-ile-gather-progress",
        "finish=data-ile-gather-open-resources",
        `tool=${ILE_GATHER_RESOURCES_TOOL}`,
      ].join("\n") + "\n",
    );
  });
});

function ilePowTotalFromDecision(counts: {
  tool: number;
  screen: number;
  video: number;
  eeg: number;
}): number {
  return counts.tool + counts.screen + counts.video + counts.eeg;
}
