import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultMapBlock,
  droppedRequiredMapBlock,
  formatOwnerFlowsForHeliosPrompt,
  MAP_BLOCK_STORE_UNAVAILABLE,
  mapBlockAllowsCalibrate,
  mapBlockAllowsLearn,
  mapBlockAllowsSolve,
  mapBlockAllowsVerify,
  mapBlockFlowHref,
  authoringMapBlockForReuse,
  authoringMapBlockKindTemplate,
  mapBlockOffersUnsysModel,
  coerceAuthoringMapBlock,
  mapBlockFromHeliosArgs,
  mapBlockHasSessionLaunch,
  mapBlockLaunch,
  mapBlockPlaceError,
  normalizeMapBlock,
  parseAuthoringMapBlockKind,
  parseMapBlock,
  parseMapBlockKind,
  restoreRequiredMapBlock,
  serializeMapBlock,
} from "@/lib/block-kind";
import { productFlowPagePath } from "@/lib/product-flow";
import {
  MAP_BLOCK_FILES_PATH,
  mapBlockAttachmentHref,
  mapBlockFileFromUpload,
} from "@/lib/map-block-files";
import {
  dispatchHeliosMapTool,
  executeHeliosMapToolCall,
  heliosMapSnapshotFromBlocks,
  heliosMapToolAwarenessText,
  type HeliosMapSnapshot,
} from "@/lib/workspace-helios-tools";
import { buildHeliosMapBuilderSystemPrompt } from "@/lib/prompt-kernel";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-cf48410bbed9/implementer";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function emptySnap(): HeliosMapSnapshot {
  return heliosMapSnapshotFromBlocks({ blocks: [], unusableCells: [] });
}

describe("map block kinds", () => {
  it("parses leftover learn/solve/calibration as verification or content", () => {
    expect(parseMapBlockKind(undefined)).toBe("content");
    expect(parseMapBlockKind("calibrate")).toBe("content");
    expect(parseMapBlockKind("verify")).toBe("verification");
    expect(parseMapBlockKind("protocol")).toBe("verification");
    expect(parseMapBlockKind("solve")).toBe("content");
    expect(parseMapBlock(null)).toEqual(defaultMapBlock());
    expect(normalizeMapBlock({ kind: "calibration", flowId: "flow-cal" })).toMatchObject({
      kind: "verification",
      flowId: "flow-cal",
    });
    expect(
      normalizeMapBlock({
        kind: "verification",
        flow_id: "flow-ver",
        flow_public_token: "tok",
      }),
    ).toMatchObject({
      kind: "verification",
      flowId: "flow-ver",
      flowPublicToken: "tok",
      flowHref: "/v/tok",
    });
    expect(
      normalizeMapBlock({
        kind: "solve",
        solve_flow_id: "flow-sol",
        flow_public_token: "stok",
      }),
    ).toMatchObject({
      kind: "verification",
      flowId: "flow-sol",
      flowPublicToken: "stok",
      flowHref: "/v/stok",
    });
    const content = normalizeMapBlock({
      kind: "content",
      files: ["notes.pdf"],
      links: ["https://example.com/paper"],
    });
    expect(content.kind).toBe("content");
    expect(content.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "file", name: "notes.pdf" }),
        expect.objectContaining({
          type: "link",
          url: "https://example.com/paper",
        }),
      ]),
    );
    expect(serializeMapBlock(defaultMapBlock())).toMatchObject({ kind: "content", attachments: [] });
    expect(serializeMapBlock(normalizeMapBlock({ kind: "calibration", flowId: "f1" }))).toMatchObject({
      kind: "verification",
      flow_id: "f1",
    });
  });

  it("launch gating is Verify-only; leftover kinds and content do not open a session", () => {
    expect(mapBlockLaunch(null)).toEqual({ action: "none" });
    expect(mapBlockAllowsLearn(null)).toBe(false);
    expect(mapBlockAllowsCalibrate(null)).toBe(false);
    expect(mapBlockAllowsVerify(null)).toBe(false);
    expect(mapBlockHasSessionLaunch(null)).toBe(false);

    const cal = { kind: "calibration", flowId: "c1", flowPublicToken: "ct" };
    expect(mapBlockLaunch(cal)).toEqual({
      action: "verify",
      flowId: "c1",
      href: "/v/ct",
    });
    expect(mapBlockAllowsLearn(cal)).toBe(false);
    expect(mapBlockAllowsCalibrate(cal)).toBe(false);
    expect(mapBlockAllowsVerify(cal)).toBe(true);

    const ver = { kind: "verification", flowId: "v1", flowHref: "/v/vt" };
    expect(mapBlockLaunch(ver)).toEqual({
      action: "verify",
      flowId: "v1",
      href: "/v/vt",
    });
    expect(mapBlockAllowsLearn(ver)).toBe(false);
    expect(mapBlockAllowsVerify(ver)).toBe(true);

    const sol = { kind: "solve", flowId: "s1", flowPublicToken: "st" };
    expect(mapBlockLaunch(sol)).toEqual({
      action: "verify",
      flowId: "s1",
      href: "/v/st",
    });
    expect(mapBlockAllowsLearn(sol)).toBe(false);
    expect(mapBlockAllowsSolve(sol)).toBe(false);
    expect(mapBlockAllowsVerify(sol)).toBe(true);

    const content = { kind: "content", attachments: [{ type: "link", name: "A", url: "https://a.example" }] };
    expect(mapBlockLaunch(content)).toEqual({ action: "none" });
    expect(mapBlockAllowsLearn(content)).toBe(false);
    expect(mapBlockHasSessionLaunch(content)).toBe(false);

    expect(mapBlockPlaceError(normalizeMapBlock({ kind: "calibration" }))).toBeNull();
    expect(mapBlockPlaceError(normalizeMapBlock({ kind: "content" }))).toBeNull();

    // Helios add_block persists flowId only (no public token). Open must still
    // resolve via mapBlockFlowHref → owner flow page, same as mapBlockLaunch.
    const heliosOnlyId = normalizeMapBlock({
      kind: "calibration",
      flowId: "cal-1",
    });
    expect(heliosOnlyId.flowHref).toBeNull();
    expect(heliosOnlyId.flowPublicToken).toBeNull();
    expect(mapBlockFlowHref(heliosOnlyId)).toBe(
      productFlowPagePath("cal-1"),
    );
    expect(mapBlockLaunch(heliosOnlyId)).toEqual({
      action: "verify",
      flowId: "cal-1",
      href: productFlowPagePath("cal-1"),
    });
    const heliosVerify = normalizeMapBlock({
      kind: "verification",
      flow_id: "ver-1",
    });
    expect(mapBlockFlowHref(heliosVerify)).toBe(
      productFlowPagePath("ver-1"),
    );
    expect(mapBlockLaunch(heliosVerify)).toEqual({
      action: "verify",
      flowId: "ver-1",
      href: productFlowPagePath("ver-1"),
    });
    const heliosSolve = normalizeMapBlock({
      kind: "solve",
      flowId: "sol-1",
    });
    expect(mapBlockFlowHref(heliosSolve)).toBe(productFlowPagePath("sol-1"));
    expect(mapBlockLaunch(heliosSolve)).toEqual({
      action: "verify",
      flowId: "sol-1",
      href: productFlowPagePath("sol-1"),
    });
  });

  it("Helios add_block places each kind on an empty cell and records it", async () => {
    const cal = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: {
        title: "Calibrate priors",
        row: 0,
        col: 0,
        kind: "verification",
        flowId: "cal-1",
        id: "cal-block",
      },
    });
    expect(cal.ok).toBe(true);
    if (!cal.ok) return;
    expect(cal.snapshot.blocks[0]).toMatchObject({
      id: "cal-block",
      map_block: expect.objectContaining({
        kind: "verification",
        flowId: "cal-1",
      }),
    });
    expect(mapBlockLaunch(cal.snapshot.blocks[0].map_block)).toEqual({
      action: "verify",
      flowId: "cal-1",
      href: productFlowPagePath("cal-1"),
    });
    expect(mapBlockFlowHref(cal.snapshot.blocks[0].map_block!)).toBe(
      productFlowPagePath("cal-1"),
    );

    const missing = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: { kind: "verification", title: "No flow" },
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error).toBe("flow_id_required");

    const created: Array<{ id: string; name: string }> = [];
    const placed: Array<{ kind?: string; flowId?: string | null }> = [];
    const createdFlow = await executeHeliosMapToolCall({
      snapshot: emptySnap(),
      call: {
        name: "add_block",
        args: {
          title: "Priors",
          kind: "verification",
          topic: "State the prior",
        },
      },
      host: {
        createFlow: async (input) => {
          created.push({ id: "new-cal", name: input.name });
          return {
            id: "new-cal",
            name: input.name,
            publicToken: "tok",
            publicPath: "/v/tok",
          };
        },
        addBlock: async ({ mapBlock }) => {
          placed.push({ kind: mapBlock?.kind, flowId: mapBlock?.flowId });
        },
      },
    });
    expect(createdFlow.ok).toBe(true);
    expect(created[0]?.id).toBe("new-cal");
    expect(placed).toEqual([{ kind: "verification", flowId: "new-cal" }]);

    const ver = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: {
        title: "Verify distance",
        row: 1,
        col: 0,
        kind: "verification",
        flowId: "ver-1",
        id: "ver-block",
      },
    });
    expect(ver.ok).toBe(true);
    if (!ver.ok) return;
    expect(ver.snapshot.blocks[0].map_block?.kind).toBe("verification");

    const leftoverSolve = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: {
        title: "Leftover solve tile",
        row: 1,
        col: 1,
        kind: "solve",
        flowId: "sol-1",
        id: "sol-block",
      },
    });
    expect(leftoverSolve.ok).toBe(true);
    if (!leftoverSolve.ok) return;
    expect(leftoverSolve.snapshot.blocks[0].map_block?.kind).toBe("verification");
    expect(mapBlockLaunch(leftoverSolve.snapshot.blocks[0].map_block)).toEqual({
      action: "verify",
      flowId: "sol-1",
      href: productFlowPagePath("sol-1"),
    });

    const content = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: {
        title: "Reading list",
        row: 2,
        col: 0,
        kind: "content",
        files: ["notes.pdf"],
        links: ["https://example.com/doc"],
        id: "content-block",
      },
    });
    expect(content.ok).toBe(true);
    if (!content.ok) return;
    expect(content.snapshot.blocks[0].map_block?.kind).toBe("content");
    expect(content.snapshot.blocks[0].map_block?.attachments.length).toBeGreaterThan(0);

    expect(parseAuthoringMapBlockKind(undefined)).toBe("verification");
    expect(parseAuthoringMapBlockKind("learn")).toBe("verification");
    expect(coerceAuthoringMapBlock(null).kind).toBe("content");
    expect(authoringMapBlockForReuse(null).kind).toBe("content");
    expect(authoringMapBlockForReuse(null).flowId).toBeNull();
    expect(
      authoringMapBlockForReuse({ kind: "solve", flowId: "sol-1" }).flowId,
    ).toBeNull();
    expect(
      authoringMapBlockKindTemplate({ kind: "verification", flowId: "v1" }).kind,
    ).toBe("verification");
    expect(
      authoringMapBlockKindTemplate({ kind: "verification", flowId: "v1" })
        .flowId,
    ).toBeNull();
    expect(mapBlockOffersUnsysModel("solve")).toBe(false);
    expect(mapBlockOffersUnsysModel("verification")).toBe(true);
    expect(mapBlockOffersUnsysModel("calibration")).toBe(false);
    expect(mapBlockOffersUnsysModel("content")).toBe(false);

    const omitted = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: { title: "Learn tile", row: 3, col: 0, id: "learn-block" },
    });
    expect(omitted.ok).toBe(false);
    if (omitted.ok) return;
    expect(omitted.error).toBe("flow_id_required");

    const retired = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: { title: "Learn tile", row: 3, col: 0, kind: "learn", id: "learn-block" },
    });
    expect(retired.ok).toBe(false);
    if (retired.ok) return;
    expect(retired.error).toBe("flow_id_required");

    const createdSolve: Array<{ id: string; name: string }> = [];
    const placedSolve: Array<{ kind?: string; flowId?: string | null }> = [];
    const omittedHosted = await executeHeliosMapToolCall({
      snapshot: emptySnap(),
      call: {
        name: "add_block",
        args: { title: "Research challenge", row: 3, col: 0 },
      },
      host: {
        createFlow: async (input) => {
          createdSolve.push({ id: "new-sol", name: input.name });
          return {
            id: "new-sol",
            name: input.name,
            publicToken: "stok",
            publicPath: "/v/stok",
          };
        },
        addBlock: async ({ mapBlock }) => {
          placedSolve.push({ kind: mapBlock?.kind, flowId: mapBlock?.flowId });
        },
      },
    });
    expect(omittedHosted.ok).toBe(true);
    expect(createdSolve[0]?.id).toBe("new-sol");
    expect(placedSolve).toEqual([{ kind: "verification", flowId: "new-sol" }]);

    const persisted: Array<{ prompt: string; kind?: string; flowId?: string | null }> = [];
    const hosted = await executeHeliosMapToolCall({
      snapshot: emptySnap(),
      call: {
        name: "add_block",
        args: {
          title: "Hosted calibrate",
          row: 4,
          col: 4,
          kind: "calibration",
          flowId: "hosted-cal",
        },
      },
      host: {
        addBlock: async ({ prompt, mapBlock }) => {
          persisted.push({
            prompt,
            kind: mapBlock?.kind,
            flowId: mapBlock?.flowId,
          });
        },
      },
    });
    expect(hosted.ok).toBe(true);
    expect(persisted).toEqual([
      { prompt: "Hosted calibrate", kind: "verification", flowId: "hosted-cal" },
    ]);
    expect(mapBlockFromHeliosArgs({ kind: "content", links: ["https://x.test"] }).kind).toBe(
      "content",
    );
  });


  it("typed map_block is required on persist retry", () => {
    const typed = {
      title: "Calibrate",
      map_block: { kind: "calibration", flow_id: "c1" },
      map_icon: "calibration",
    };
    const dropped = { title: "Calibrate" };
    expect(droppedRequiredMapBlock(typed, dropped)).toBe(true);
    expect(droppedRequiredMapBlock(typed, restoreRequiredMapBlock(typed, dropped))).toBe(
      false,
    );
    expect(restoreRequiredMapBlock(typed, dropped)).toMatchObject({
      title: "Calibrate",
      map_block: { kind: "calibration", flow_id: "c1" },
      map_icon: "calibration",
    });
    expect(droppedRequiredMapBlock({ title: "Learn" }, { title: "Learn" })).toBe(false);
    expect(MAP_BLOCK_STORE_UNAVAILABLE).toMatch(/verification/);
  });
});
