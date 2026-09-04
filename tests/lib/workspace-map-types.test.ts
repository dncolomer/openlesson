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
import {
  MAP_TYPE_LIBRARY_CORE,
  MAP_TYPE_LIBRARY_EXTRAS,
} from "@/lib/map-type-library";
import { INITIAL_CHAPTERS_LEVELS } from "@/lib/initial-chapters";
import { DEFAULT_PROMPTS } from "@/lib/prompts";
import {
  blankCustomMapType,
  clampPositionsToMapTypeFrame,
  defaultMapTypePickerCatalog,
  importLibraryMapType,
  formatMapTypeGeneratorContext,
  mapTypePickerCatalog,
  mapTypeRecordFromBuiltin,
  mapTypeTopologyResemblance,
  normalizeMapTypeCells,
  normalizeWorkspaceMapTypes,
  removeCustomMapType,
  removeLibraryMapType,
  resolveMapTypeIdFromBody,
  resolveMapTypeRecord,
  resolveWorkspaceMapTypeCatalog,
  serializeWorkspaceMapTypes,
  setBuiltinMapTypeEnabled,
  applyMapTypePaint,
  setMapTypeOrderStepCount,
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
    expect(catalog.map((i) => i.id).sort()).toEqual([...INITIAL_CHAPTERS_LEVELS].sort());
    expect(catalog.some((i) => i.id === "spiral_curriculum")).toBe(false);
    expect(catalog.some((i) => i.id === "epitome_zoom")).toBe(false);
    expect(catalog.some((i) => i.id === "funnel")).toBe(false);
    expect(catalog.some((i) => i.id === "chambers")).toBe(false);
    expect(MAP_TYPE_LIBRARY_CORE.every((e) => e.defaultImported)).toBe(true);
    expect(MAP_TYPE_LIBRARY_CORE.map((e) => e.id).sort()).toEqual(
      [...INITIAL_CHAPTERS_LEVELS].sort(),
    );
  });

  it("official extra library types import onto a workspace catalog without replacing defaults", () => {
    expect(MAP_TYPE_LIBRARY_EXTRAS.map((e) => e.id)).toEqual(
      expect.arrayContaining([
        "spiral_curriculum",
        "epitome_zoom",
        "strands",
        "trajectories",
        "criss_cross",
        "web_first",
        "interleaved_mosaic",
        "whole_task_bands",
        "funnel",
        "switchbacks",
        "hourglass",
        "delta",
        "chambers",
      ]),
    );
    for (const extra of MAP_TYPE_LIBRARY_EXTRAS) {
      expect(extra.defaultImported).toBe(false);
      expect((INITIAL_CHAPTERS_LEVELS as readonly string[]).includes(extra.id)).toBe(
        false,
      );
      expect(extra.occupied.length).toBeGreaterThan(0);
      expect(extra.playRule.length).toBeGreaterThan(20);
    }
    const imported = importLibraryMapType(
      { disabledBuiltinIds: [], importedLibraryIds: [], customTypes: [] },
      "trajectories",
    );
    const catalog = resolveWorkspaceMapTypeCatalog(imported);
    expect(catalog.map((t) => t.id)).toContain("trajectories");
    expect(catalog.map((t) => t.id)).toContain("islands");
    const prompt = composeSessionPlanCreatePrompt(DEFAULT_PROMPTS.session_plan_create, {
      problem: "Algebra",
      initialChapters: "trajectories",
      mapTypesState: imported,
    });
    expect(prompt).toMatch(/Trajectories|fringe|DAG/i);

    const withoutHub = removeLibraryMapType(
      { disabledBuiltinIds: [], customTypes: [] },
      "hub",
    );
    const afterRemove = resolveWorkspaceMapTypeCatalog(withoutHub);
    expect(afterRemove.map((t) => t.id)).not.toContain("hub");
    expect(afterRemove.map((t) => t.id)).toContain("islands");
    const restored = importLibraryMapType(withoutHub, "hub");
    expect(resolveWorkspaceMapTypeCatalog(restored).map((t) => t.id)).toContain(
      "hub",
    );
    const serialized = serializeWorkspaceMapTypes(withoutHub);
    expect(serialized.selectedLibraryIds || []).not.toContain("hub");
    expect(serialized.disabledBuiltinIds).toContain("hub");
    const remigrated = normalizeWorkspaceMapTypes({
      disabledBuiltinIds: serialized.disabledBuiltinIds,
      importedLibraryIds: serialized.importedLibraryIds,
      customTypes: [],
    });
    expect(remigrated.selectedLibraryIds || []).not.toContain("hub");
    expect(remigrated.selectedLibraryIds || []).toContain("islands");
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

  it("custom spawn / blocked marks round-trip; empty cells mean no-spawn; clear erases", () => {
    let custom = blankCustomMapType({
      id: "maptype_roundtrip",
      label: "River delta",
    });
    custom = applyMapTypePaint(custom, 0, 0, { kind: "spawn" });
    custom = applyMapTypePaint(custom, 3, 3, { kind: "blocked" });
    custom = applyMapTypePaint(custom, 1, 2, { kind: "spawn" });
    custom = applyMapTypePaint(custom, 1, 2, { kind: "clear" });
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
        { row: 3, col: 3, mark: "blocked" },
      ]),
    );
    expect(round.cells.some((c) => c.row === 1 && c.col === 2)).toBe(false);
    expect(round.layoutInstruction).toMatch(/river/i);
  });

  it("order-step areas paint independently of spawn and feed generator DAG text", () => {
    let custom = setMapTypeOrderStepCount(
      blankCustomMapType({ id: "maptype_orders", label: "Path" }),
      3,
    );
    custom = applyMapTypePaint(custom, 0, 0, { kind: "spawn" });
    custom = applyMapTypePaint(custom, 0, 0, { kind: "order", step: 1 });
    custom = applyMapTypePaint(custom, 0, 1, { kind: "order", step: 1 });
    custom = applyMapTypePaint(custom, 2, 2, { kind: "order", step: 2 });
    custom = applyMapTypePaint(custom, 2, 2, { kind: "order", step: 3 });
    expect(custom.cells).toEqual(
      expect.arrayContaining([{ row: 0, col: 0, mark: "spawn" }]),
    );
    expect(custom.orderSteps.find((s) => s.step === 1)?.cells).toEqual(
      expect.arrayContaining([
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ]),
    );
    expect(custom.orderSteps.find((s) => s.step === 2)?.cells || []).toHaveLength(0);
    expect(custom.orderSteps.find((s) => s.step === 3)?.cells).toEqual([
      { row: 2, col: 2 },
    ]);
    const ctx = formatMapTypeGeneratorContext(custom);
    expect(ctx.orderInstruction).toMatch(/ORDER STEPS/i);
    expect(ctx.orderInstruction).toMatch(/lock_until_orders/i);
    expect(ctx.countInstruction).toMatch(/Area 1/);
    expect(ctx.countInstruction).toMatch(/Area 3/);
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
      { row: 2, col: 2, mark: "blocked" },
    ];
    custom.layoutInstruction = "Keep a single crossing.";

    const builtinCtx = formatMapTypeGeneratorContext(builtin);
    const customCtx = formatMapTypeGeneratorContext(custom);
    expect(builtinCtx.spawnInstruction).toMatch(/SPAWN SKELETON/i);
    expect(builtinCtx.blockedInstruction).toMatch(/BLOCKED CHAPTER SLOTS/i);
    expect(customCtx.spawnInstruction).toMatch(/SPAWN SKELETON/i);
    expect(customCtx.blockedInstruction).toMatch(/BLOCKED CHAPTER SLOTS/i);

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
    expect(customPrompt).toMatch(/BLOCKED CHAPTER SLOTS/i);
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
    expect(panel).toContain('kind: "spawn"');
    expect(panel).not.toContain("mapTypesNoSpawn");
    expect(panel).toContain('kind: "blocked"');
    expect(panel).toContain('kind: "clear"');
    expect(panel).toContain("data-map-type-paint-drag");
    expect(panel).toContain("data-map-type-order-count");
    expect(panel).toContain("data-map-type-label");
    expect(panel).toContain("data-map-type-description");
    expect(panel).toContain("data-map-type-layout");
    expect(panel).toContain("data-map-type-band");
    expect(panel).toContain('data-map-type-editor-layout="grid-form-prompt"');
    expect(panel).toContain("lg:flex-row-reverse");
    expect(panel).toContain("lg:w-[22rem]");
    expect(panel).not.toContain("lg:grid-cols-2");
    expect(panel).toContain('data-map-type-stage="grid"');
    expect(panel).toContain("data-map-type-fields");
    expect(panel).toContain("data-map-type-context-preview");
    expect(panel).toContain("data-map-type-prompt-title");
    expect(enJson.planView.mapTypesPromptTitle).toBe("Generator prompt");
    expect(panel).not.toContain("lg:w-64");
    expect(panel).not.toContain("max-h-64");
    const editorSrc = panel.slice(panel.indexOf("data-map-type-editor"));
    const gridPos = editorSrc.indexOf('data-map-type-stage="grid"');
    const fieldsPos = editorSrc.indexOf("data-map-type-fields");
    const previewPos = editorSrc.indexOf("data-map-type-context-preview");
    expect(fieldsPos).toBeGreaterThan(-1);
    expect(gridPos).toBeGreaterThan(fieldsPos);
    expect(previewPos).toBeGreaterThan(gridPos);
    expect(editorSrc).toMatch(
      /data-map-type-context-preview[\s\S]{0,120}min-h-72 w-full/,
    );
    expect(panel).toContain("applyMapTypePaint");
    expect(panel).toContain("data-map-type-create");
    expect(panel).toContain("data-map-type-save");
    expect(panel).toContain("data-map-type-delete");
    expect(panel).not.toContain("data-map-types-builtins");
    expect(panel).not.toContain("data-map-type-builtin-enabled");
    expect(panel).toContain("data-map-types-library");
    expect(panel).toContain("data-map-type-library-remove");
    expect(panel).toContain("data-map-type-custom-remove");
    expect(panel).toContain('data-map-type-browse-filter="in_workspace"');
    expect(panel).toContain("MAP_TYPE_LIBRARY");
    expect(panel).not.toContain("data-map-type-simulate");
    expect(panel).not.toContain("/api/workspace/map-types/simulate");
    expect(panel).toContain("data-map-type-browse");
    expect(panel).toContain("data-map-type-library-add");
    expect(panel).not.toContain("data-map-type-publish");
    expect(read("app/api/map-types/library/route.ts")).toContain(
      "Custom map types cannot be published",
    );
    expect(read("lib/map-type-library.ts")).toContain("spiral_curriculum");
    expect(read("lib/map-type-library.ts")).toContain("MAP_TYPE_LIBRARY_CORE");
    expect(read("app/api/map-types/library/route.ts")).toContain("MAP_TYPE_LIBRARY");

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
        "spawn=" + panel.includes('kind: "spawn"'),
        "blocked=" + panel.includes('kind: "blocked"'),
        "clear=" + panel.includes('kind: "clear"'),
        "drag=" + panel.includes("data-map-type-paint-drag"),
        "build_only_host=" + view.includes("!isLearnerMode"),
        "grid_form_prompt=" +
          panel.includes('data-map-type-editor-layout="grid-form-prompt"'),
        "no_prompt_rail=" +
          String(!panel.includes("lg:w-64") && !panel.includes("max-h-64")),
        "prompt_min_h_72=" + panel.includes("min-h-72 w-full"),
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
      { row: 2, col: 2, mark: "blocked" },
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
