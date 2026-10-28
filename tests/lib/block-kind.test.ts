import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultMapBlock,
  droppedRequiredMapBlock,
  formatOwnerFlowsForHeliosPrompt,
  MAP_BLOCK_STORE_UNAVAILABLE,
  mapBlockAllowsCalibrate,
  mapBlockAllowsLearn,
  mapBlockAllowsVerify,
  mapBlockFlowHref,
  mapBlockFromHeliosArgs,
  mapBlockHasSessionLaunch,
  mapBlockLaunch,
  mapBlockPlaceError,
  normalizeMapBlock,
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
  it("parses learn default, calibration, verification, and content payloads", () => {
    expect(parseMapBlockKind(undefined)).toBe("learn");
    expect(parseMapBlockKind("calibrate")).toBe("calibration");
    expect(parseMapBlockKind("verify")).toBe("verification");
    expect(parseMapBlock(null)).toEqual(defaultMapBlock());
    expect(normalizeMapBlock({ kind: "calibration", flowId: "flow-cal" })).toMatchObject({
      kind: "calibration",
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
    expect(serializeMapBlock(defaultMapBlock())).toBeNull();
    expect(serializeMapBlock(normalizeMapBlock({ kind: "calibration", flowId: "f1" }))).toMatchObject({
      kind: "calibration",
      flow_id: "f1",
    });
  });

  it("launch gating is Calibrate-only, Verify-only, none for content, Learn for untyped", () => {
    expect(mapBlockLaunch(null)).toEqual({ action: "learn" });
    expect(mapBlockAllowsLearn(null)).toBe(true);
    expect(mapBlockAllowsCalibrate(null)).toBe(false);
    expect(mapBlockAllowsVerify(null)).toBe(false);
    expect(mapBlockHasSessionLaunch(null)).toBe(true);

    const cal = { kind: "calibration", flowId: "c1", flowPublicToken: "ct" };
    expect(mapBlockLaunch(cal)).toEqual({
      action: "calibrate",
      flowId: "c1",
      href: "/c/ct",
    });
    expect(mapBlockAllowsLearn(cal)).toBe(false);
    expect(mapBlockAllowsCalibrate(cal)).toBe(true);
    expect(mapBlockAllowsVerify(cal)).toBe(false);

    const ver = { kind: "verification", flowId: "v1", flowHref: "/v/vt" };
    expect(mapBlockLaunch(ver)).toEqual({
      action: "verify",
      flowId: "v1",
      href: "/v/vt",
    });
    expect(mapBlockAllowsLearn(ver)).toBe(false);
    expect(mapBlockAllowsVerify(ver)).toBe(true);

    const content = { kind: "content", attachments: [{ type: "link", name: "A", url: "https://a.example" }] };
    expect(mapBlockLaunch(content)).toEqual({ action: "none" });
    expect(mapBlockAllowsLearn(content)).toBe(false);
    expect(mapBlockHasSessionLaunch(content)).toBe(false);

    expect(mapBlockPlaceError(normalizeMapBlock({ kind: "calibration" }))).toBe(
      "flow_id_required",
    );
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
      productFlowPagePath("calibration", "cal-1"),
    );
    expect(mapBlockLaunch(heliosOnlyId)).toEqual({
      action: "calibrate",
      flowId: "cal-1",
      href: productFlowPagePath("calibration", "cal-1"),
    });
    const heliosVerify = normalizeMapBlock({
      kind: "verification",
      flow_id: "ver-1",
    });
    expect(mapBlockFlowHref(heliosVerify)).toBe(
      productFlowPagePath("verification", "ver-1"),
    );
    expect(mapBlockLaunch(heliosVerify)).toEqual({
      action: "verify",
      flowId: "ver-1",
      href: productFlowPagePath("verification", "ver-1"),
    });
  });

  it("Helios add_block places each kind on an empty cell and records it", async () => {
    const cal = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: {
        title: "Calibrate priors",
        row: 0,
        col: 0,
        kind: "calibration",
        flowId: "cal-1",
        id: "cal-block",
      },
    });
    expect(cal.ok).toBe(true);
    if (!cal.ok) return;
    expect(cal.snapshot.blocks[0]).toMatchObject({
      id: "cal-block",
      map_block: expect.objectContaining({
        kind: "calibration",
        flowId: "cal-1",
      }),
    });
    expect(mapBlockLaunch(cal.snapshot.blocks[0].map_block)).toEqual({
      action: "calibrate",
      flowId: "cal-1",
      href: productFlowPagePath("calibration", "cal-1"),
    });
    expect(mapBlockFlowHref(cal.snapshot.blocks[0].map_block!)).toBe(
      productFlowPagePath("calibration", "cal-1"),
    );

    const missing = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: { kind: "verification", title: "No flow" },
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error).toBe("flow_id_required");

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

    const learn = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: { title: "Learn tile", row: 3, col: 0, id: "learn-block" },
    });
    expect(learn.ok).toBe(true);
    if (!learn.ok) return;
    expect(learn.snapshot.blocks[0].map_block == null || learn.snapshot.blocks[0].map_block.kind === "learn").toBe(
      true,
    );
    expect(mapBlockAllowsLearn(learn.snapshot.blocks[0].map_block)).toBe(true);

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
      { prompt: "Hosted calibrate", kind: "calibration", flowId: "hosted-cal" },
    ]);
    expect(mapBlockFromHeliosArgs({ kind: "content", links: ["https://x.test"] }).kind).toBe(
      "content",
    );
  });

  it("Manual add and Helios catalog name calibration, verification, and content", () => {
    const add = read("components/WorkspaceAddBlockPane.tsx");
    const fields = read("components/WorkspaceMapBlockFields.tsx");
    const catalog = heliosMapToolAwarenessText();
    const prompt = buildHeliosMapBuilderSystemPrompt();
    const persist = read("lib/workspace-helios-tools/persist.ts");
    const slot = read("app/api/workspace/add-block-at-slot/route.ts");
    const migration = read("supabase/migrations/20261028200000_blocks_map_block.sql");

    expect(add).toContain("WorkspaceMapBlockKindPicker");
    expect(add).toContain("calibration");
    expect(add).toContain("verification");
    expect(add).toContain("content");
    expect(fields).toContain("calibration");
    expect(fields).toContain("verification");
    expect(fields).toContain("content");
    expect(fields).toContain("mapBlockFlowHref(block)");
    expect(fields).toContain("mapBlockKindIconName");
    expect(fields).toContain("BlockMapGlyphIcon");
    expect(fields).not.toMatch(
      /block\.flowHref\s*\|\|[\s\S]*flowPublicToken/,
    );
    expect(catalog).toContain("calibration");
    expect(catalog).toContain("verification");
    expect(catalog).toContain("content");
    expect(catalog).toContain("flowId");
    expect(prompt).toContain("calibration");
    expect(prompt).toContain("verification");
    expect(prompt).toContain("content");
    expect(prompt).toContain("flowId");
    expect(persist).toContain("mapBlock: mapBlockFromHeliosArgs(args)");
    expect(read("components/workspace-view/workspace-right-drawers.tsx")).toContain(
      "map_block: parseMapBlock(n.map_block)",
    );
    expect(slot).toContain("map_block");
    expect(slot).toContain("serializeMapBlock");
    expect(slot).toContain("MAP_BLOCK_STORE_UNAVAILABLE");
    expect(slot).toContain("restoreRequiredMapBlock");
    expect(migration).toContain("map_block");
    expect(migration).toContain("NOTIFY pgrst");
    expect(read("lib/pow-api/helios-map-agent.ts")).toContain(
      "drop === \"map_block\"",
    );
    expect(read("lib/pow-api/helios-map-agent.ts")).toContain(
      "MAP_BLOCK_STORE_UNAVAILABLE",
    );
    expect(read("lib/workspace-grid-ops/clone_block.ts")).toContain(
      "MAP_BLOCK_STORE_UNAVAILABLE",
    );
    expect(read("lib/workspace-grid-ops/update_block.ts")).toContain(
      "MAP_BLOCK_STORE_UNAVAILABLE",
    );
    expect(formatOwnerFlowsForHeliosPrompt({
      calibration: [{ id: "c1", name: "Priors" }],
      verification: [{ id: "v1", name: "Distance" }],
    })).toContain("c1");
  });

  it("content drawer uploads file bytes via org-scoped xAI Files", () => {
    const fields = read("components/WorkspaceMapBlockFields.tsx");
    const add = read("components/WorkspaceAddBlockPane.tsx");
    const route = read("app/api/workspace/map-block-files/route.ts");
    const uploaded = mapBlockFileFromUpload({
      name: "notes.pdf",
      mimeType: "application/pdf",
      xaiFileId: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      workspaceId: "ws-1",
    });
    expect(uploaded).toMatchObject({
      type: "file",
      name: "notes.pdf",
      xaiFileId: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
    expect(uploaded.url).toContain(MAP_BLOCK_FILES_PATH);
    expect(uploaded.url).toContain("fileId=file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(
      mapBlockAttachmentHref(uploaded, {
        workspaceId: "ws-1",
        ayclToken: "tok",
      }),
    ).toContain("ayclToken=tok");
    expect(
      serializeMapBlock(
        normalizeMapBlock({ kind: "content", attachments: [uploaded] }),
      ),
    ).toMatchObject({
      kind: "content",
      attachments: [
        expect.objectContaining({
          type: "file",
          xaiFileId: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        }),
      ],
    });
    expect(fields).toContain("uploadMapBlockFile");
    expect(fields).toContain("data-map-block-content-upload");
    expect(fields).toContain("data-map-block-content-file");
    expect(add).toContain("workspaceId={workspaceId}");
    expect(route).toContain("uploadOrgScopedXaiFile");
    expect(route).toContain("getOrgScopedFileContentResponse");
    expect(route).not.toContain("uploadFileToXAI(");
    expect(read("lib/map-block-files.ts")).toContain(MAP_BLOCK_FILES_PATH);
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
    expect(MAP_BLOCK_STORE_UNAVAILABLE).toMatch(/calibration/);
  });
});
