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
  mapBlockAllowsSolve,
  mapBlockAllowsVerify,
  mapBlockFlowHref,
  authoringMapBlockForReuse,
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
  it("parses learn default, calibration, verification, solve, and content payloads", () => {
    expect(parseMapBlockKind(undefined)).toBe("learn");
    expect(parseMapBlockKind("calibrate")).toBe("calibration");
    expect(parseMapBlockKind("verify")).toBe("verification");
    expect(parseMapBlockKind("solve")).toBe("solve");
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
    expect(
      normalizeMapBlock({
        kind: "solve",
        solve_flow_id: "flow-sol",
        flow_public_token: "stok",
      }),
    ).toMatchObject({
      kind: "solve",
      flowId: "flow-sol",
      flowPublicToken: "stok",
      flowHref: "/s/stok",
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

    const sol = { kind: "solve", flowId: "s1", flowPublicToken: "st" };
    expect(mapBlockLaunch(sol)).toEqual({
      action: "solve",
      flowId: "s1",
      href: "/s/st",
    });
    expect(mapBlockAllowsLearn(sol)).toBe(false);
    expect(mapBlockAllowsSolve(sol)).toBe(true);
    expect(mapBlockAllowsVerify(sol)).toBe(false);

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
    const heliosSolve = normalizeMapBlock({
      kind: "solve",
      flowId: "sol-1",
    });
    expect(mapBlockFlowHref(heliosSolve)).toBe(productFlowPagePath("solve", "sol-1"));
    expect(mapBlockLaunch(heliosSolve)).toEqual({
      action: "solve",
      flowId: "sol-1",
      href: productFlowPagePath("solve", "sol-1"),
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

    const created: Array<{ id: string; kind: string }> = [];
    const placed: Array<{ kind?: string; flowId?: string | null }> = [];
    const createdFlow = await executeHeliosMapToolCall({
      snapshot: emptySnap(),
      call: {
        name: "add_block",
        args: {
          title: "Priors",
          kind: "calibration",
          goal: "State the prior",
          questions: ["What is the prior?"],
        },
      },
      host: {
        createFlow: async (input) => {
          created.push({ id: "new-cal", kind: input.kind });
          return {
            id: "new-cal",
            kind: input.kind,
            name: input.name,
            publicToken: "tok",
            publicPath: "/c/tok",
          };
        },
        addBlock: async ({ mapBlock }) => {
          placed.push({ kind: mapBlock?.kind, flowId: mapBlock?.flowId });
        },
      },
    });
    expect(createdFlow.ok).toBe(true);
    expect(created).toEqual([{ id: "new-cal", kind: "calibration" }]);
    expect(placed).toEqual([{ kind: "calibration", flowId: "new-cal" }]);

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

    const sol = dispatchHeliosMapTool(emptySnap(), {
      name: "add_block",
      args: {
        title: "Solve limits",
        row: 1,
        col: 1,
        kind: "solve",
        flowId: "sol-1",
        id: "sol-block",
      },
    });
    expect(sol.ok).toBe(true);
    if (!sol.ok) return;
    expect(sol.snapshot.blocks[0].map_block?.kind).toBe("solve");
    expect(mapBlockLaunch(sol.snapshot.blocks[0].map_block)).toEqual({
      action: "solve",
      flowId: "sol-1",
      href: productFlowPagePath("solve", "sol-1"),
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

    expect(parseAuthoringMapBlockKind(undefined)).toBe("solve");
    expect(parseAuthoringMapBlockKind("learn")).toBe("solve");
    expect(coerceAuthoringMapBlock(null).kind).toBe("solve");
    expect(authoringMapBlockForReuse(null)).toBeNull();
    expect(
      authoringMapBlockForReuse({ kind: "solve", flowId: "sol-1" })?.flowId,
    ).toBe("sol-1");

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

    const createdSolve: Array<{ id: string; kind: string }> = [];
    const placedSolve: Array<{ kind?: string; flowId?: string | null }> = [];
    const omittedHosted = await executeHeliosMapToolCall({
      snapshot: emptySnap(),
      call: {
        name: "add_block",
        args: { title: "Research challenge", row: 3, col: 0 },
      },
      host: {
        createFlow: async (input) => {
          createdSolve.push({ id: "new-sol", kind: input.kind });
          return {
            id: "new-sol",
            kind: input.kind,
            name: input.name,
            publicToken: "stok",
            publicPath: "/s/stok",
          };
        },
        addBlock: async ({ mapBlock }) => {
          placedSolve.push({ kind: mapBlock?.kind, flowId: mapBlock?.flowId });
        },
      },
    });
    expect(omittedHosted.ok).toBe(true);
    expect(createdSolve).toEqual([{ id: "new-sol", kind: "solve" }]);
    expect(placedSolve).toEqual([{ kind: "solve", flowId: "new-sol" }]);

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

  it("Manual add and Helios catalog name calibration, verification, solve, and content", () => {
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
    expect(add).toContain("solve");
    expect(add).toContain("content");
    expect(fields).toContain("calibration");
    expect(fields).toContain("verification");
    expect(fields).toContain("solve");
    expect(fields).toContain("content");
    expect(fields).toContain("Open solve flow");
    expect(fields).toContain("mapBlockFlowHref(block)");
    expect(fields).toContain("mapBlockKindIconName");
    expect(fields).toContain("BlockMapGlyphIcon");
    expect(fields).not.toMatch(
      /block\.flowHref\s*\|\|[\s\S]*flowPublicToken/,
    );
    expect(catalog).toContain("calibration");
    expect(catalog).toContain("verification");
    expect(catalog).toContain("solve");
    expect(catalog).toContain("content");
    expect(catalog).toContain("flowId");
    expect(prompt).toContain("calibration");
    expect(prompt).toContain("verification");
    expect(prompt).toContain("solve");
    expect(prompt).toContain("content");
    expect(prompt).toContain("flowId");
    expect(persist).toContain("heliosResolvedMapBlock(args)");
    expect(persist).toContain("createFlow");
    expect(persist).toContain("heliosWillCreateFlow");
    expect(persist).toContain("attach_content");
    expect(fields).toContain("data-map-block-create-flow");
    expect(fields).toContain('target="_blank"');
    expect(fields).toContain("productFlowNewPath");
    expect(read("lib/workspace-right-pane.ts")).toContain(
      'ids.push("clone", "edit", WORKSPACE_EDITOR_DANGER_DRAWER_ID)',
    );
    expect(read("components/WorkspaceBlockDetailPane.tsx")).toContain(
      '? "edit"',
    );
    expect(prompt).toContain("search_web");
    expect(prompt).toContain("attach_content");
    expect(prompt).toContain("create_flow");
    expect(catalog).toContain("search_web");
    expect(catalog).toContain("omit flowId");
    expect(read("components/workspace-view/workspace-right-drawers.tsx")).toContain(
      "map_block: parseMapBlock(n.map_block)",
    );
    expect(read("components/workspace-view/workspace-right-drawers.tsx")).toContain(
      "workspaceId,",
    );
    expect(read("app/api/dashboard/flows/route.ts")).toContain(
      "body.workspaceId || body.workspace_id",
    );
    expect(read("lib/pow-api/helios-map-agent.ts")).toContain(
      "ensureAuthoringMapBlock",
    );
    expect(slot).toContain("map_block");
    expect(slot).toContain("serializeMapBlock");
    expect(slot).toContain("MAP_BLOCK_STORE_UNAVAILABLE");
    expect(slot).toContain("restoreRequiredMapBlock");
    expect(slot).toContain("ensureAuthoringMapBlock");
    expect(add).toContain('useState<MapBlockKind>("solve")');
    expect(read("lib/workspace-grid-ops/generate_shape.ts")).toContain(
      "ensureAuthoringMapBlock",
    );
    expect(read("lib/workspace-helios-tools/catalog.ts")).not.toContain(
      "learn (default)",
    );
    expect(prompt).toContain("never learn");
    expect(catalog).toContain("never learn");
    expect(catalog).toContain("You pick kind per cell");
    expect(prompt).toContain("TILE KINDS");
    expect(read("lib/workspace-helios-expertise.ts")).toContain("TILE KINDS");
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
    const ownerFlows = formatOwnerFlowsForHeliosPrompt({
      calibration: [{ id: "c1", name: "Priors" }],
      verification: [{ id: "v1", name: "Distance" }],
    });
    expect(ownerFlows).toContain("c1");
    expect(ownerFlows).toContain("omit flowId");
    expect(ownerFlows).not.toContain("do not invent a flow id");
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
    expect(route).toContain("fetchPublicFileAsBase64");
    expect(read("lib/map-block-files.ts")).toContain("uploadMapBlockFileFromUrl");
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
