import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readWorkspaceViewSurface, readSessionViewSurface } from "@/tests/helpers/surface-source";
import {
  availableWorkspaceSections,
  resolveWorkspaceSectionLayout,
} from "@/lib/workspace-sections";
import { availableSectionsForMode } from "@/lib/workspace-mode";
import { buildWorkspaceSectionNavItems } from "@/components/workspace-view/workspace-section-nav-items";
import { composeSessionPlanCreatePrompt } from "@/lib/session-plan-create";
import { DEFAULT_PROMPTS } from "@/lib/prompts";
import {
  blankCustomMapType,
  clampPositionsToMapTypeFrame,
  defaultMapTypePickerCatalog,
  formatMapTypeGeneratorContext,
  mapTypePickerCatalog,
  mapTypeRecordFromBuiltin,
  mapTypeTopologyResemblance,
  normalizeMapTypeCells,
  normalizeWorkspaceMapTypes,
  removeCustomMapType,
  resolveMapTypeIdFromBody,
  resolveMapTypeRecord,
  resolveWorkspaceMapTypeCatalog,
  serializeWorkspaceMapTypes,
  setBuiltinMapTypeEnabled,
  setMapTypeCellMark,
  upsertCustomMapType,
} from "@/lib/workspace-map-types";

const SCRATCH =
  process.env.GROK_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-d04191785a5f/implementer";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("workspace map types helpers", () => {
  it("default picker catalog items include mini-map cells for the preview grid", () => {
    const catalog = defaultMapTypePickerCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    for (const item of catalog) {
      expect(item.cells.length).toBeGreaterThan(0);
      expect(item.cells.some((c) => c.kind === "occupied" || c.kind === "blocked")).toBe(
        true,
      );
    }
  });

  it("Build-mode section list includes Map Types; Play/Explore/KR do not", () => {
    const creator = availableSectionsForMode({
      mode: "creator",
      isOwner: true,
    });
    expect(creator).toContain("map_types");
    expect(creator.indexOf("map_types")).toBe(creator.indexOf("dags") + 1);

    expect(
      availableSectionsForMode({
        mode: "learner",
        isOwner: true,
        isLoggedIn: true,
      }),
    ).not.toContain("map_types");

    expect(
      availableWorkspaceSections({
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).not.toContain("map_types");

    const t = (key: string) => key;
    const enCopy = JSON.parse(read("messages/en.json")) as {
      planView: Record<string, string>;
    };
    expect(enCopy.planView.sectionMapTypes).toBe("Map Types");
    const labeledNav = buildWorkspaceSectionNavItems({
      t: (key) =>
        key === "planView.sectionMapTypes"
          ? enCopy.planView.sectionMapTypes
          : key,
      isLearnerMode: false,
      isOwner: true,
      visibleSections: creator,
    });
    expect(labeledNav.map((item) => item.key)).toContain("map_types");
    expect(labeledNav.find((item) => item.key === "map_types")?.label).toBe(
      "Map Types",
    );

    const playNav = buildWorkspaceSectionNavItems({
      t,
      isLearnerMode: true,
      isOwner: true,
      visibleSections: creator,
    });
    expect(playNav.map((item) => item.key)).not.toContain("map_types");

    const exploreNav = buildWorkspaceSectionNavItems({
      t,
      isLearnerMode: false,
      isOwner: true,
      visibleSections: creator,
      exploreOpen: true,
    });
    expect(exploreNav.map((item) => item.key)).not.toContain("map_types");

    const layout = resolveWorkspaceSectionLayout("map_types");
    expect(layout.mountsMapTypesPanel).toBe(true);
    expect(layout.showBlockMapChrome).toBe(false);
  });

  it("custom spawn / no-spawn / blocked marks round-trip through normalize/persist", () => {
    let cells = setMapTypeCellMark([], 0, 0, "spawn");
    cells = setMapTypeCellMark(cells, 1, 2, "no_spawn");
    cells = setMapTypeCellMark(cells, 3, 3, "blocked");
    cells = setMapTypeCellMark(cells, 4, 1, "dag_hint");
    const custom = blankCustomMapType({
      id: "maptype_roundtrip",
      label: "River delta",
    });
    custom.cells = cells;
    custom.dagHintIds = ["dag_a"];
    custom.layoutInstruction = "Prefer a branching river of chapters.";
    const afterUpsert = upsertCustomMapType(
      { disabledBuiltinIds: [], customTypes: [] },
      custom,
    );
    const serialized = serializeWorkspaceMapTypes(afterUpsert);
    const restored = normalizeWorkspaceMapTypes(serialized);
    expect(restored.customTypes).toHaveLength(1);
    const round = restored.customTypes[0]!;
    expect(round.id).toBe("maptype_roundtrip");
    expect(round.label).toBe("River delta");
    expect(normalizeMapTypeCells(round.cells)).toEqual(
      expect.arrayContaining([
        { row: 0, col: 0, mark: "spawn" },
        { row: 1, col: 2, mark: "no_spawn" },
        { row: 3, col: 3, mark: "blocked" },
        { row: 4, col: 1, mark: "dag_hint" },
      ]),
    );
    expect(round.dagHintIds).toEqual(["dag_a"]);
    expect(round.layoutInstruction).toMatch(/river/i);
  });

  it("disabling a built-in drops it from the picker catalog; custom types appear", () => {
    let state = setBuiltinMapTypeEnabled(
      { disabledBuiltinIds: [], customTypes: [] },
      "spiral",
      false,
    );
    const custom = blankCustomMapType({
      id: "maptype_harbor",
      label: "Harbor",
    });
    custom.cells = [{ row: 2, col: 2, mark: "spawn" }];
    state = upsertCustomMapType(state, custom);
    const catalog = resolveWorkspaceMapTypeCatalog(state);
    expect(catalog.map((t) => t.id)).not.toContain("spiral");
    expect(catalog.map((t) => t.id)).toContain("islands");
    expect(catalog.map((t) => t.id)).toContain("maptype_harbor");
    const picker = mapTypePickerCatalog(state);
    expect(picker.some((p) => p.id === "maptype_harbor")).toBe(true);
    expect(picker.some((p) => p.id === "spiral")).toBe(false);

    const allOff = INITIAL_CHAPTERS_OFF(state);
    const fallback = resolveWorkspaceMapTypeCatalog(allOff);
    expect(fallback).toHaveLength(1);
    expect(fallback[0]!.id).toBe("islands");
  });

  it("one formatter for built-in and custom; session-plan create prompt includes the fill", () => {
    const builtin = mapTypeRecordFromBuiltin("islands");
    const custom = blankCustomMapType({
      id: "maptype_bridge",
      label: "Bridge path",
    });
    custom.cells = [
      { row: 0, col: 0, mark: "spawn" },
      { row: 1, col: 1, mark: "no_spawn" },
      { row: 2, col: 2, mark: "blocked" },
      { row: 3, col: 3, mark: "dag_hint" },
    ];
    custom.dagHintIds = ["dag_core"];
    custom.layoutInstruction = "Keep a single crossing.";

    const builtinCtx = formatMapTypeGeneratorContext(builtin);
    const customCtx = formatMapTypeGeneratorContext(custom);
    expect(builtinCtx.spawnInstruction).toMatch(/SPAWN SKELETON/i);
    expect(builtinCtx.blockedInstruction).toMatch(/BLOCKED CHAPTER SLOTS/i);
    expect(customCtx.spawnInstruction).toMatch(/SPAWN SKELETON/i);
    expect(customCtx.noSpawnInstruction).toMatch(/NO-SPAWN CELLS/i);
    expect(customCtx.blockedInstruction).toMatch(/BLOCKED CHAPTER SLOTS/i);
    expect(customCtx.dagHintInstruction).toMatch(/DAG HINTS/i);

    // Id-only path (no pre-built record) — same formatter composeSessionPlanCreatePrompt uses.
    const builtinPrompt = composeSessionPlanCreatePrompt(
      DEFAULT_PROMPTS.session_plan_create,
      { problem: "Graphs", initialChapters: "islands" },
    );
    expect(builtinPrompt).toContain(builtinCtx.countInstruction);
    expect(builtinPrompt).toMatch(/SPAWN SKELETON/i);
    expect(builtinPrompt).toMatch(/BLOCKED CHAPTER SLOTS/i);
    expect(builtinPrompt).toMatch(/TOPOLOGY FIDELITY/i);
    expect(builtinPrompt).not.toContain("{initial_chapters_instruction}");

    const customState = upsertCustomMapType(
      { disabledBuiltinIds: [], customTypes: [] },
      custom,
    );
    const customPrompt = composeSessionPlanCreatePrompt(
      DEFAULT_PROMPTS.session_plan_create,
      {
        problem: "Graphs",
        initialChapters: custom.id,
        mapTypesState: customState,
      },
    );
    expect(customPrompt).toContain(customCtx.countInstruction);
    expect(customPrompt).toMatch(/SPAWN SKELETON/i);
    expect(customPrompt).toMatch(/NO-SPAWN CELLS/i);
    expect(customPrompt).toMatch(/BLOCKED CHAPTER SLOTS/i);
    expect(customPrompt).toMatch(/DAG HINTS/i);
    expect(customPrompt).toContain("maptype_bridge");

    expect(
      resolveMapTypeIdFromBody({ initial_chapters: custom.id }, customState),
    ).toBe("maptype_bridge");
  });

  it("Hub topology prompt keeps the schematic hub and overrides four-quadrant scatter", () => {
    const hub = mapTypeRecordFromBuiltin("hub");
    const ctx = formatMapTypeGeneratorContext(hub);
    expect(hub.topologyMode).toBe("shaped");
    expect(ctx.topologyInstruction).toMatch(/80%/);
    expect(ctx.topologyInstruction).toMatch(/FOUNDATION CELL/i);
    expect(ctx.spatialInstruction).toMatch(/SUPERSEDES/i);
    expect(ctx.spatialInstruction).not.toMatch(
      /Place nodes across positive AND negative/i,
    );
    expect(ctx.spawnInstruction).toMatch(/SPAWN SKELETON/i);
    const prompt = composeSessionPlanCreatePrompt(DEFAULT_PROMPTS.session_plan_create, {
      problem: "Schemas",
      initialChapters: "hub",
    });
    expect(prompt).toContain(ctx.countInstruction);
    expect(prompt).toContain(ctx.spatialInstruction);
    expect(prompt).toMatch(/FOUNDATION CELL/i);
    expect(prompt).not.toMatch(/Place nodes across positive AND negative/i);

    const sparse = composeSessionPlanCreatePrompt(DEFAULT_PROMPTS.session_plan_create, {
      problem: "Schemas",
      initialChapters: "random_sparse",
    });
    expect(sparse).toMatch(/negative/i);
  });

  it("clamps far-away generated tiles into the Hub frame and scores resemblance", () => {
    const hub = mapTypeRecordFromBuiltin("hub");
    const spawn = hub.cells.filter((c) => c.mark === "spawn");
    const onSkeleton = mapTypeTopologyResemblance(spawn, hub);
    expect(onSkeleton.score).toBe(1);
    const far = mapTypeTopologyResemblance(
      [
        { row: -12, col: -9 },
        { row: 20, col: 18 },
      ],
      hub,
    );
    expect(far.score).toBe(0);
    const clamped = clampPositionsToMapTypeFrame(
      [
        { position_x: -12, position_y: -9 },
        { position_x: 20, position_y: 18 },
        { position_x: 3, position_y: 3 },
      ],
      hub,
    );
    for (const item of clamped) {
      expect(item.position_x).toBeGreaterThanOrEqual(-1);
      expect(item.position_x).toBeLessThanOrEqual(8);
      expect(item.position_y).toBeGreaterThanOrEqual(-1);
      expect(item.position_y).toBeLessThanOrEqual(8);
    }
    const after = mapTypeTopologyResemblance(
      clamped.map((c) => ({ row: c.position_y!, col: c.position_x! })),
      hub,
    );
    expect(after.score).toBeGreaterThan(far.score);
  });
});

function INITIAL_CHAPTERS_OFF(state: ReturnType<typeof normalizeWorkspaceMapTypes>) {
  let next = state;
  for (const id of [
    "islands",
    "spiral",
    "ladder",
    "hub",
    "tracks",
    "ring",
    "random_sparse",
    "random_dense",
  ] as const) {
    next = setBuiltinMapTypeEnabled(next, id, false);
  }
  next = {
    ...next,
    customTypes: next.customTypes.map((t) => ({ ...t, enabled: false })),
  };
  return next;
}

describe("Map Types tab UI / API structural", () => {
  it("nav + panel grid marks; persist column; picker uses workspace catalog", () => {
    const view = readWorkspaceViewSurface();
    const panel = read("components/WorkspaceMapTypesPanel.tsx");
    const sections = read("lib/workspace-sections.ts");
    const en = read("messages/en.json");
    const mod = read("lib/workspace-map-types.ts");
    const migration = read(
      "supabase/migrations/20260903140000_workspace_map_types.sql",
    );
    const picker = read("components/InitialChaptersPicker.tsx");
    const welcome = read("components/session-view/session-welcome-modal.tsx");
    const sessionView = readSessionViewSurface();
    const createRoute = read("app/api/session-plan/create/route.ts");
    const workspaceApi = read("app/api/workspace/map-types/route.ts");
    const sessionApi = read("app/api/session-plan/map-types/route.ts");

    expect(sections).toContain('"map_types"');
    expect(sections).toContain("mountsMapTypesPanel");
    const enJson = JSON.parse(en) as { planView: Record<string, string> };
    expect(enJson.planView.sectionMapTypes).toBe("Map Types");

    expect(view).toContain('key: "map_types"');
    expect(view).toContain("sectionMapTypes");
    expect(view).toContain("WorkspaceMapTypesPanel");
    expect(view).toContain("data-workspace-map-types-host");
    expect(view).toContain("exploreOpen: showMapExplore");
    expect(view).toMatch(
      /!isLearnerMode &&\s*isOwner &&\s*sectionLayout\.mountsMapTypesPanel &&\s*visibleSections\.includes\("map_types"\)/,
    );

    expect(panel).toContain("data-workspace-map-types-panel");
    expect(panel).toContain("data-map-type-grid");
    expect(panel).toContain('mark: "spawn"');
    expect(panel).toContain('mark: "no_spawn"');
    expect(panel).toContain('mark: "blocked"');
    expect(panel).toContain("data-map-type-create");
    expect(panel).toContain("data-map-type-save");
    expect(panel).toContain("data-map-type-delete");
    expect(panel).toContain("data-map-type-builtin-enabled");
    expect(panel).toContain("data-map-type-simulate");
    expect(panel).toContain("/api/workspace/map-types/simulate");
    const simulate = read("app/api/workspace/map-types/simulate/route.ts");
    expect(simulate).toContain("createSessionPlanLLM");
    expect(simulate).toContain("mapTypeTopologyResemblance");

    expect(mod).toContain("export function formatMapTypeGeneratorContext");
    expect(mod).toContain("export function resolveWorkspaceMapTypeCatalog");
    expect(mod).toContain("export function normalizeWorkspaceMapTypes");
    expect(migration).toContain("workspace_map_types");
    expect(workspaceApi).toContain("workspace_map_types");
    expect(sessionApi).toContain("mapTypePickerCatalog");

    expect(picker).toContain("catalog");
    expect(picker).toContain("defaultMapTypePickerCatalog");
    expect(welcome).toContain("mapTypeCatalog");
    expect(sessionView).toContain("/api/session-plan/map-types");
    expect(createRoute).toContain("resolveMapTypeIdFromBody");
    expect(createRoute).toContain("resolveMapTypeRecord");

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "map-types-tab.log"),
      [
        "map-types-tab",
        "label=Map Types",
        "section_key=map_types",
        "build_has=" +
          String(
            availableSectionsForMode({
              mode: "creator",
              isOwner: true,
            }).includes("map_types"),
          ),
        "play_excludes=" +
          String(
            !availableSectionsForMode({
              mode: "learner",
              isOwner: true,
              isLoggedIn: true,
            }).includes("map_types"),
          ),
        "explore_nav_excludes=" +
          String(
            !buildWorkspaceSectionNavItems({
              t: (k) => k,
              isLearnerMode: false,
              isOwner: true,
              visibleSections: availableSectionsForMode({
                mode: "creator",
                isOwner: true,
              }),
              exploreOpen: true,
            })
              .map((i) => i.key)
              .includes("map_types"),
          ),
        "kr_excludes=" +
          String(
            !availableWorkspaceSections({
              isOwner: true,
              workspaceKind: "knowledge_region",
            }).includes("map_types"),
          ),
        "grid=" + panel.includes("data-map-type-grid"),
        "spawn=" + panel.includes('mark: "spawn"'),
        "no_spawn=" + panel.includes('mark: "no_spawn"'),
        "blocked=" + panel.includes('mark: "blocked"'),
        "build_only_host=" + view.includes("!isLearnerMode"),
      ].join("\n") + "\n",
    );

    writeFileSync(
      join(SCRATCH, "map-types-picker.log"),
      [
        "map-types-picker",
        "picker_catalog_prop=" + picker.includes("catalog"),
        "welcome_catalog=" + welcome.includes("mapTypeCatalog"),
        "session_fetch=" + sessionView.includes("/api/session-plan/map-types"),
        "create_resolver=" + createRoute.includes("resolveMapTypeIdFromBody"),
        "create_formatter_path=" + createRoute.includes("resolveMapTypeRecord"),
        "custom_id_accepted=" +
          String(
            resolveMapTypeIdFromBody(
              { initial_chapters: "maptype_harbor" },
              upsertCustomMapType(
                { disabledBuiltinIds: [], customTypes: [] },
                blankCustomMapType({ id: "maptype_harbor", label: "Harbor" }),
              ),
            ) === "maptype_harbor",
          ),
      ].join("\n") + "\n",
    );
  });
});

describe("map types verification evidence", () => {
  it("id-only compose + catalog disable/custom still hold", () => {
    const custom = blankCustomMapType({ id: "maptype_harbor", label: "Harbor" });
    custom.cells = [
      { row: 0, col: 1, mark: "spawn" },
      { row: 2, col: 2, mark: "no_spawn" },
      { row: 5, col: 5, mark: "blocked" },
    ];
    const state = setBuiltinMapTypeEnabled(
      upsertCustomMapType({ disabledBuiltinIds: [], customTypes: [] }, custom),
      "ring",
      false,
    );
    const catalog = resolveWorkspaceMapTypeCatalog(state);
    const customCtx = formatMapTypeGeneratorContext(
      resolveMapTypeRecord("maptype_harbor", state),
    );
    const prompt = composeSessionPlanCreatePrompt(DEFAULT_PROMPTS.session_plan_create, {
      problem: "Proofs",
      initialChapters: "maptype_harbor",
      mapTypesState: state,
    });
    expect(catalog.some((t) => t.id === "maptype_harbor")).toBe(true);
    expect(catalog.some((t) => t.id === "ring")).toBe(false);
    expect(prompt).toContain(customCtx.countInstruction);
    expect(removeCustomMapType(state, "maptype_harbor").customTypes).toHaveLength(0);
  });
});
