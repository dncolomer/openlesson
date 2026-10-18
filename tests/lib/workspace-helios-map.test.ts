import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readWorkspaceViewSurface } from "../helpers/surface-source";
import {
  DEFAULT_WORKSPACE_HELIOS_COLUMN_MODE,
  HELIOS_MAP_MODE_LABEL,
  MANUAL_MAP_MODE_LABEL,
  normalizeWorkspaceHeliosColumnMode,
  resolveWorkspaceHeliosColumnSurface,
  toggleWorkspaceHeliosColumnMode,
} from "@/lib/workspace-helios-mode";
import {
  HELIOS_MAP_EXPERTISE_BLOCK,
  HELIOS_MAP_SURFACE,
  HELIOS_MAP_TOOLS_BLOCK,
  HELIOS_MAP_TYPES_BLOCK,
  buildHeliosMapBuilderSystemPrompt,
} from "@/lib/prompt-kernel";
import {
  MAP_TYPE_LIBRARY,
  MAP_TYPE_LIBRARY_CORE,
  MAP_TYPE_LIBRARY_EXTRAS,
} from "@/lib/map-type-library";
import {
  formatHeliosWorkspaceMapTypesForPrompt,
  heliosMapExpertiseText,
  heliosMapTypeAwarenessText,
  heliosWorkspaceMapTypesFromUnknown,
  serializeHeliosWorkspaceMapTypes,
} from "@/lib/workspace-helios-expertise";
import {
  HELIOS_MAP_TOOL_CATALOG,
  heliosMapToolAwarenessText,
} from "@/lib/workspace-helios-tools";
import { LANDING_FEATURED_MAPS } from "@/lib/marketing/landing-featured-maps";
import {
  HELIOS_MAP_OPENING_EXAMPLES,
  HELIOS_MAP_OPENING_QUESTION,
  heliosMapOpeningAwarenessText,
  heliosMapOpeningMarkdown,
} from "@/lib/workspace-helios-opening";
import {
  heliosSpeechFinalDelta,
  heliosSpeechUtteranceFromEvent,
} from "@/lib/workspace-helios-voice";
import {
  formatHeliosMapSelectionForPrompt,
  heliosMapSelectionFromUnknown,
  heliosSelectionContext,
  serializeHeliosMapSelection,
} from "@/lib/workspace-helios-selection";
import { nextWorkspaceMapSelection } from "@/lib/workspace-map-selection";
import {
  capHeliosAttachedFiles,
  formatHeliosFilesForPrompt,
  HELIOS_MAP_FILES_FALLBACK_PROMPT,
  HELIOS_MAP_MAX_ATTACHED_FILES,
  normalizeHeliosFileMime,
  parseHeliosAttachedFiles,
  parseHeliosWorkspaceFileNames,
} from "@/lib/workspace-helios-files";
import type { SpeechRecognitionEventLike } from "@/lib/useSessionThoughtInterface";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-630c02a0abfd/implementer";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function writeEvidence(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("Helios / Manual Learning Map column mode", () => {
  it("defaults to Helios and toggles Manual drawers then back", () => {
    const start = resolveWorkspaceHeliosColumnSurface({
      authoring: true,
    });
    expect(DEFAULT_WORKSPACE_HELIOS_COLUMN_MODE).toBe("helios");
    expect(start.mode).toBe("helios");
    expect(start.showManualDrawers).toBe(false);
    expect(start.showHeliosChat).toBe(true);
    expect(start.showModeToggle).toBe(true);

    const manual = resolveWorkspaceHeliosColumnSurface({
      authoring: true,
      mode: toggleWorkspaceHeliosColumnMode(start.mode),
    });
    expect(manual.mode).toBe("manual");
    expect(manual.showHeliosChat).toBe(false);
    expect(manual.showManualDrawers).toBe(true);

    const back = resolveWorkspaceHeliosColumnSurface({
      authoring: true,
      mode: toggleWorkspaceHeliosColumnMode(manual.mode),
    });
    expect(back.mode).toBe("helios");
    expect(back.showManualDrawers).toBe(false);
    expect(back.showHeliosChat).toBe(true);
    expect(normalizeWorkspaceHeliosColumnMode("nope")).toBe("helios");

    writeEvidence(
      "helios-map-mode.log",
      [
        "default=" + start.mode,
        "afterToggle=" + manual.mode,
        "heliosChat=" + start.showHeliosChat,
        "heliosDrawers=" + start.showManualDrawers,
        "back=" + back.mode,
        "labels=" + HELIOS_MAP_MODE_LABEL + "/" + MANUAL_MAP_MODE_LABEL,
      ].join("\n"),
    );
  });

  it("play-only / no-authoring shells do not gain Helios map-building", () => {
    const play = resolveWorkspaceHeliosColumnSurface({
      authoring: true,
      playView: true,
      mode: "helios",
    });
    expect(play.showModeToggle).toBe(false);
    expect(play.showHeliosChat).toBe(false);
    expect(play.mode).toBe("manual");

    const learner = resolveWorkspaceHeliosColumnSurface({
      authoring: false,
      mode: "helios",
    });
    expect(learner.showModeToggle).toBe(false);
    expect(learner.showHeliosChat).toBe(false);
  });
});

describe("Helios map right-column chrome", () => {
  it("Helios mounts Helios Chat; Manual Mode keeps the drawer stack", () => {
    const drawers = read("components/workspace-view/workspace-right-drawers.tsx");
    const chat = read("components/WorkspaceHeliosChat.tsx");
    const view = readWorkspaceViewSurface();

    expect(HELIOS_MAP_MODE_LABEL).toBe("Helios");
    expect(MANUAL_MAP_MODE_LABEL).toBe("Manual Mode");
    expect(drawers).toContain("Helios");
    expect(drawers).toContain("Manual Mode");
    expect(drawers).not.toContain("Helios Mode");
    expect(drawers).toContain("data-workspace-helios-mode-toggle");
    expect(drawers).toContain('data-helios-map-mode-option="helios"');
    expect(drawers).toContain('data-helios-map-mode-option="manual"');
    expect(drawers).toContain("resolveWorkspaceHeliosColumnSurface");
    expect(drawers).toContain("<WorkspaceHeliosChat");
    expect(drawers).toContain("heliosSurface.showHeliosChat");
    expect(drawers).toContain("heliosSurface.showManualDrawers");
    expect(drawers).toContain('data-workspace-block-drawers=""');
    expect(drawers).toContain("WorkspaceAddBlockPane");
    expect(drawers).toContain("WorkspaceGenerateShapePane");
    expect(drawers).toContain("WorkspaceCombineBlocksPane");
    expect(drawers).toMatch(
      /showHeliosChat \? \([\s\S]*<WorkspaceHeliosChat/,
    );
    expect(drawers).toMatch(
      /showManualDrawers &&[\s\S]*rightPane === "add_block"/,
    );
    expect(drawers).toMatch(
      /showManualDrawers &&[\s\S]*rightPane === "generate_shape"/,
    );
    expect(drawers).toMatch(
      /showManualDrawers &&[\s\S]*rightPane === "combine_blocks"/,
    );
    expect(drawers).toMatch(
      /showManualDrawers &&[\s\S]*data-workspace-block-drawers/,
    );
    expect(chat).toContain("data-workspace-helios-chat");
    expect(chat).toContain("data-workspace-helios-chat-input");
    expect(chat).toContain("border border-white/30 bg-black/55");
    expect(chat).toContain('aria-label="Message Helios"');
    expect(chat).not.toMatch(
      /className="w-full resize-none bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-600"/,
    );
    expect(chat).toContain("data-workspace-helios-chat-mic");
    expect(chat).toContain('import { Mic } from "lucide-react"');
    expect(chat).toContain('<Mic className="h-4 w-4" aria-hidden="true" />');
    expect(chat).not.toContain(">Mic</");
    expect(chat).not.toContain(">Mic on</");
    expect(chat).toMatch(
      /data-workspace-helios-chat-mic[\s\S]*data-workspace-helios-chat-send/,
    );
    expect(chat).toContain("applyHeliosMapToolsAtomically");
    expect(chat).toContain("data-workspace-helios-tool-trace-toggle");
    expect(chat).toContain(
      "const [showToolTrace, setShowToolTrace] = useState(false)",
    );
    expect(chat).toContain('kind !== "tool"');
    expect(chat).toContain("startLiveSpeechRecognition");
    expect(chat).toContain("Learning Map builder");
    expect(chat).toContain("data-workspace-helios-opening");
    expect(chat).toContain("data-workspace-helios-opening-question");
    expect(chat).toContain("data-workspace-helios-opening-example");
    expect(chat).toContain("data-workspace-helios-opening-examples");
    expect(chat).toContain("heliosMapOpeningMarkdown");
    expect(chat).toContain("HELIOS_MAP_OPENING_EXAMPLES");
    expect(chat).toContain("enqueuePrompt(example.prompt)");
    expect(chat).toContain("snapshot: snapshotRef.current");
    expect(chat).toContain("selection: serializeHeliosMapSelection(selectionRef.current)");
    expect(chat).toContain("data-workspace-helios-context");
    expect(chat).toContain("data-workspace-helios-selection");
    expect(chat).toContain("data-workspace-helios-selection-kind");
    expect(chat).toContain("data-workspace-helios-selection-chip");
    expect(chat).toContain("data-workspace-helios-selection-empty");
    expect(chat).toContain("heliosSelectionContext");
    expect(chat).toContain("data-workspace-helios-files");
    expect(chat).toContain("data-workspace-helios-files-attach");
    expect(chat).toContain("data-workspace-helios-files-chip");
    expect(chat).toContain("data-workspace-helios-files-empty");
    expect(chat).toContain("data-workspace-helios-files-input");
    expect(chat).toContain("files: attachedRef.current");
    expect(chat).toContain("workspaceFileNames: workspaceFileNamesRef.current");
    expect(chat).toContain("mapTypes: serializeHeliosWorkspaceMapTypes(mapTypesRef.current)");
    expect(chat).toContain("HELIOS_MAP_FILES_FALLBACK_PROMPT");
    expect(drawers).toContain("workspaceFileItems={workspaceFileItems}");
    expect(drawers).toContain("mapSelection={mapSelection}");
    expect(drawers).toContain("workspaceMapTypes={workspaceMapTypes}");
    expect(view).toMatch(
      /<WorkspaceRightDrawers[\s\S]*mapSelection=\{mapSelection\}/,
    );
    expect(view).toMatch(
      /<WorkspaceRightDrawers[\s\S]*workspaceMapTypes=\{workspaceMapTypes\}/,
    );
    expect(chat).toContain("cursor-pointer");
    expect(chat).toContain("type=\"button\"");
    expect(drawers).toContain("pointer-events-none absolute inset-0 bg-black/35");
    expect(drawers).toContain("applySnapshot");
    expect(drawers).toContain("heliosMapSnapshotToAuthoringNodes");
    expect(drawers).toContain("onPreviewUnusableCells");
    expect(drawers).toContain("onApplyHeliosOverlay");
    expect(drawers).toContain("mapOverlay");
    expect(chat).toContain("snapshot: snapshotRef.current");
    const grid = read("components/BlockSkillGrid.tsx");
    expect(grid).toContain("injectHeliosOverlay");
    expect(grid).toContain("persistAnnotationLayers");
    expect(view).toContain("WorkspaceHeliosChat");
    expect(view).toContain("onClonePaste");
    expect(view).toContain("onPreviewUnusableCells");
    expect(view).not.toContain("<WorkspaceChat");
    expect(view).not.toContain("SessionHeliosPanel");
    const api = read("app/api/workspace/helios-map-chat/route.ts");
    expect(api).toContain("buildHeliosMapBuilderSystemPrompt");
    expect(api).toContain("requireAyclAuthoring: true");
    expect(api).toContain("heliosMapSnapshotFromUnknown");
    expect(api).toContain("formatHeliosMapSnapshotForPrompt");
    expect(api).toContain("formatHeliosMapSelectionForPrompt");
    expect(api).toContain("heliosMapSelectionFromUnknown");
    expect(api).toContain("body.selection");
    expect(api).toContain("formatHeliosFilesForPrompt");
    expect(api).toContain("formatHeliosWorkspaceMapTypesForPrompt");
    expect(api).toContain("heliosWorkspaceMapTypesFromUnknown");
    expect(api).toContain("body.mapTypes ?? body.map_types");
    expect(api).toContain("parseHeliosAttachedFiles");
    expect(api).toContain("uploadOrgScopedXaiFile");
    expect(api).toContain("callXaiResponses");
    expect(api).toContain("input_file");
    expect(api).toContain("input_image");

    writeEvidence(
      "helios-map-chrome.log",
      [
        "labels=" +
          drawers.includes(HELIOS_MAP_MODE_LABEL) +
          "/" +
          drawers.includes(MANUAL_MAP_MODE_LABEL),
        "chatMount=" + drawers.includes("<WorkspaceHeliosChat"),
        "drawersMarker=" + drawers.includes("data-workspace-block-drawers"),
        "addPane=" + drawers.includes("WorkspaceAddBlockPane"),
        "shapePane=" + drawers.includes("WorkspaceGenerateShapePane"),
        "combinePane=" + drawers.includes("WorkspaceCombineBlocksPane"),
        "gatedByShowHeliosChat=" +
          /showHeliosChat \? \([\s\S]*<WorkspaceHeliosChat/.test(drawers),
        "manualAdd=" +
          /showManualDrawers &&[\s\S]*rightPane === "add_block"/.test(drawers),
        "mic=" + chat.includes("data-workspace-helios-chat-mic"),
        "atomic=" + chat.includes("applyHeliosMapToolsAtomically"),
        "speech=" + chat.includes("startLiveSpeechRecognition"),
      ].join("\n"),
    );
  });
});

describe("Helios map browser transcript", () => {
  it("extracts final speech deltas for talk-to-Helios", () => {
    const event = {
      resultIndex: 1,
      results: [
        { isFinal: true, 0: { transcript: "add a block" } },
        { isFinal: false, 0: { transcript: "on the left" } },
      ],
    } as unknown as SpeechRecognitionEventLike;
    const spoken = heliosSpeechUtteranceFromEvent(event);
    expect(spoken.finals).toBe("add a block");
    expect(spoken.interim).toBe("on the left");
    expect(heliosSpeechFinalDelta("add a block on the left", "add a block")).toBe(
      "on the left",
    );
    expect(heliosSpeechFinalDelta("add a block", "add a block")).toBe("");
  });
});

describe("Helios map opening", () => {
  it("always starts from what we want to build, with specific topic examples", () => {
    expect(HELIOS_MAP_OPENING_QUESTION).toBe(
      "What do we want to build in this map?",
    );
    const markdown = heliosMapOpeningMarkdown();
    expect(markdown).toContain(HELIOS_MAP_OPENING_QUESTION);
    expect(markdown).toMatch(/Stay with the idea before we place blocks/);
    expect(markdown).toMatch(/What should someone be able to do after they walk it/);
    expect(markdown).toMatch(/path, a fork, or open terrain/);
    expect(HELIOS_MAP_OPENING_EXAMPLES.map((example) => example.id)).toEqual([
      "surface-code-mwpm-neural-decoding",
      "prime-editing-pegrna",
      "sae-circuit-discovery",
      "stark-fri-proximity",
    ]);
    expect(HELIOS_MAP_OPENING_EXAMPLES.map((example) => example.label)).toEqual([
      "Surface-code MWPM vs neural decoding",
      "CRISPR prime-editing pegRNA design",
      "Sparse autoencoder circuit discovery",
      "STARK FRI proximity proofs",
    ]);
    for (const example of HELIOS_MAP_OPENING_EXAMPLES) {
      const featured = LANDING_FEATURED_MAPS.find(
        (map) => map.slug === example.id,
      );
      expect(featured, example.id).toBeTruthy();
      expect(example.label).toBe(featured?.title);
      expect(example.prompt).toMatch(/Learning Map/);
    }
    const awareness = heliosMapOpeningAwarenessText();
    expect(awareness).toContain(HELIOS_MAP_OPENING_QUESTION);
    expect(awareness).toMatch(/Do not spray an unprompted map/);
    expect(awareness).toMatch(/choose a map type and build that topology/);
  });
});

describe("Helios map selection context", () => {
  it("represents none, one block, many blocks, and empty cells", () => {
    const snapshot = {
      blocks: [
        { id: "a", title: "Decoder", position_x: 0, position_y: 0 },
        { id: "b", title: "Encoder", position_x: 1, position_y: 0 },
      ],
    };
    const none = heliosSelectionContext(
      nextWorkspaceMapSelection({ type: "clear" }),
      snapshot,
    );
    expect(none.kind).toBe("none");
    expect(none.active).toBe(false);
    expect(none.summary).toBe("No block selected");
    expect(none.chips).toEqual([]);
    expect(none.prompt).toMatch(/kind: none/);
    expect(none.prompt).toMatch(/No block selected/);

    const one = heliosSelectionContext(
      nextWorkspaceMapSelection({ type: "open_block", blockId: "a" }),
      snapshot,
    );
    expect(one.kind).toBe("block");
    expect(one.active).toBe(true);
    expect(one.chips).toEqual([
      { key: "a", label: "Decoder", hint: "0:0" },
    ]);
    expect(one.prompt).toContain('id=a title="Decoder" origin=(0:0)');

    const many = heliosSelectionContext(
      nextWorkspaceMapSelection({
        type: "set_filled_ids",
        blockIds: ["a", "b"],
      }),
      snapshot,
    );
    expect(many.kind).toBe("blocks");
    expect(many.summary).toBe("2 blocks");
    expect(many.chips.map((chip) => chip.label)).toEqual([
      "Decoder",
      "Encoder",
    ]);

    const empties = heliosSelectionContext(
      nextWorkspaceMapSelection({
        type: "set_empty_cells",
        cells: [
          { row: 2, col: 3 },
          { row: 2, col: 4 },
        ],
      }),
      snapshot,
    );
    expect(empties.kind).toBe("empties");
    expect(empties.summary).toBe("2 empty cells");
    expect(empties.chips.map((chip) => chip.label)).toEqual(["2:3", "2:4"]);
    expect(empties.prompt).toContain("cell 2:3");
    expect(empties.prompt).toMatch(/Place or generate on these selected empty cells/);

    expect(serializeHeliosMapSelection(one.kind === "block" ? { kind: "block", id: "a" } : { kind: "none" })).toEqual({
      kind: "block",
      id: "a",
    });
    expect(heliosMapSelectionFromUnknown({ kind: "block", id: "a" })).toEqual({
      kind: "block",
      id: "a",
    });
    expect(
      formatHeliosMapSelectionForPrompt(
        { kind: "block", id: "a" },
        snapshot,
      ),
    ).toContain("SELECTION");
  });
});

describe("Helios map file attachments", () => {
  it("parses local uploads and workspace names, and formats prompt context", () => {
    expect(HELIOS_MAP_MAX_ATTACHED_FILES).toBe(5);
    expect(HELIOS_MAP_FILES_FALLBACK_PROMPT).toMatch(/attached files/);
    expect(normalizeHeliosFileMime("notes.md", "")).toBe("text/markdown");
    const parsed = parseHeliosAttachedFiles([
      {
        name: "notes.md",
        mimeType: "text/markdown",
        data: Buffer.from("MWPM vs neural decoding").toString("base64"),
      },
      { name: "skip.exe", mimeType: "application/octet-stream", data: "QQ==" },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("notes.md");
    expect(parseHeliosWorkspaceFileNames(["a.pdf", "a.pdf", "b.txt"])).toEqual([
      "a.pdf",
      "b.txt",
    ]);
    const capped = capHeliosAttachedFiles(
      Array.from({ length: 4 }, (_, i) => ({
        name: `f${i}.txt`,
        mimeType: "text/plain",
        data: "YQ==",
        size: 1,
      })),
      ["keep.pdf", "drop.pdf"],
    );
    expect(capped.workspace).toEqual(["keep.pdf", "drop.pdf"]);
    expect(capped.local).toHaveLength(3);
    const prompt = formatHeliosFilesForPrompt({
      attached: parsed,
      workspaceNames: ["paper.pdf"],
    });
    expect(prompt).toMatch(/ATTACHED FILES/);
    expect(prompt).toContain("notes.md");
    expect(prompt).toContain("MWPM vs neural decoding");
    expect(prompt).toContain("paper.pdf");
    expect(prompt).toMatch(/Ground the map/);
  });
});

describe("Helios Learning Map expertise", () => {
  it("teaches pedagogy and lists official map types", () => {
    const expertise = heliosMapExpertiseText();
    expect(expertise).toMatch(/LEARNING MAP EXPERTISE/);
    expect(expertise).toMatch(/not a linear syllabus/);
    expect(expertise).toMatch(/Spatial structure is the teaching/);
    expect(expertise).toMatch(/Do not dump a row of blocks/);
    expect(expertise).toMatch(/~80% resemblance/);
    expect(expertise).toMatch(/Prefer a shaped official type/);
    expect(HELIOS_MAP_EXPERTISE_BLOCK).toBe(expertise);

    const types = heliosMapTypeAwarenessText();
    expect(types).toMatch(/MAP TYPES \(official Learning Map topologies/);
    expect(types).toMatch(/CORE \(on every new workspace\)/);
    expect(types).toMatch(/LIBRARY EXTRAS/);
    expect(HELIOS_MAP_TYPES_BLOCK).toBe(types);
    for (const entry of MAP_TYPE_LIBRARY) {
      expect(types).toContain(`- ${entry.id} "${entry.label}"`);
      expect(types).toContain(entry.layoutInstruction);
    }
    expect(MAP_TYPE_LIBRARY_CORE.map((entry) => entry.id)).toEqual([
      "islands",
      "spiral",
      "ladder",
      "hub",
      "tracks",
      "ring",
      "random_sparse",
      "random_dense",
    ]);
    expect(MAP_TYPE_LIBRARY_EXTRAS.map((entry) => entry.id)).toEqual([
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
    ]);
  });

  it("formats live workspace map types for the user message", () => {
    const payload = serializeHeliosWorkspaceMapTypes({
      selectedLibraryIds: ["islands", "hourglass", "islands"],
      customTypes: [
        {
          id: "custom_river",
          label: "River",
          description: "A long meander of related skills.",
          enabled: true,
        },
        { id: "off", label: "Off", enabled: false },
      ],
    });
    expect(payload.selectedLibraryIds).toEqual(["islands", "hourglass"]);
    expect(payload.custom).toEqual([
      {
        id: "custom_river",
        label: "River",
        description: "A long meander of related skills.",
      },
    ]);
    const fromUnknown = heliosWorkspaceMapTypesFromUnknown({
      selected_library_ids: ["ladder"],
      custom: [{ id: "custom_a", label: "A", description: "alpha" }],
    });
    expect(fromUnknown.selectedLibraryIds).toEqual(["ladder"]);
    const prompt = formatHeliosWorkspaceMapTypesForPrompt(payload);
    expect(prompt).toMatch(/WORKSPACE MAP TYPES/);
    expect(prompt).toContain('- islands "Islands"');
    expect(prompt).toContain('- hourglass "Hourglass"');
    expect(prompt).toContain('- custom_river "River" [custom]');
    expect(formatHeliosWorkspaceMapTypesForPrompt({})).toBe("");
  });
});

describe("Helios map-builder prompt / tool-awareness", () => {
  it("names Helios as the Learning Map expert and lists tool families", () => {
    const prompt = buildHeliosMapBuilderSystemPrompt();
    expect(prompt).toContain("Helios");
    expect(prompt).toMatch(/Learning Map expert/);
    expect(prompt).toMatch(/Learning Map builder helper/i);
    expect(prompt).toContain(HELIOS_MAP_OPENING_QUESTION);
    expect(prompt).toMatch(/abstract layer/);
    expect(prompt).toMatch(/surface-code MWPM vs neural decoding/);
    expect(prompt).toMatch(/hard-domain STEM/);
    expect(prompt).toMatch(/CURRENT MAP/);
    expect(prompt).toMatch(/SELECTION/);
    expect(prompt).toMatch(/ATTACHED FILES/);
    expect(prompt).toMatch(/WORKSPACE MAP TYPES/);
    expect(prompt).toMatch(/ground the map in that material/);
    expect(prompt).toMatch(/Prefer mutating selected blocks/);
    expect(prompt).toMatch(/row 0, col 0/);
    expect(prompt).toMatch(/LEARNING MAP EXPERTISE/);
    expect(prompt).toMatch(/not a linear syllabus/);
    expect(prompt).toMatch(/MAP TYPES \(official Learning Map topologies/);
    expect(prompt).toContain("- islands");
    expect(prompt).toContain("- spiral");
    expect(prompt).toContain("- ladder");
    expect(prompt).toContain("- hub");
    expect(prompt).toContain("- tracks");
    expect(prompt).toContain("- ring");
    expect(prompt).toContain("- hourglass");
    expect(prompt).toContain("- chambers");
    expect(prompt).toContain("- funnel");
    expect(prompt).toContain("- criss_cross");
    expect(prompt).not.toContain("generate_map");
    expect(HELIOS_MAP_SURFACE).toMatch(/Learning Map expert/);
    expect(HELIOS_MAP_SURFACE).toMatch(/Learning Map builder/i);
    expect(HELIOS_MAP_TOOLS_BLOCK).toBe(heliosMapToolAwarenessText());
    expect(prompt).toContain("add_block");
    expect(prompt).toContain("generate_shape");
    expect(prompt).toContain("mark_unusable");
    expect(prompt).toContain("set_dynamic_effect");
    expect(prompt).toContain("set_generator_effect");
    expect(prompt).toContain("apply_dag");
    expect(prompt).toContain("combine_blocks");
    expect(prompt).toContain("bridge_blocks");
    expect(prompt).toMatch(/Default thickness is 1 cell/);
    expect(prompt).toContain('"width": 0');
    expect(prompt).toContain("cluster_blocks");
    expect(prompt).toContain("split_block");
    expect(prompt).toContain("add_note");
    expect(prompt).toContain("add_drawing_layer");
    expect(prompt).toContain("draw_on_layer");
    expect(prompt).toMatch(/topologies/i);
    expect(prompt).toMatch(/drawing layer/i);
    expect(prompt).toMatch(/map notes/i);
    expect(prompt).toMatch(/unusable ground/i);
    expect(prompt).toMatch(/generative/i);
    expect(prompt).toMatch(/DAG/i);
    for (const tool of HELIOS_MAP_TOOL_CATALOG) {
      expect(prompt).toContain(tool.id);
    }
  });
});
