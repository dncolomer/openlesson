/**
 * Helios Learning Map builder tool catalog. Families match Manual Mode
 * drawers (topologies, unusable, generative, DAG, edit, overlay).
 */

export const HELIOS_MAP_TOOL_IDS = [
  "add_block",
  "generate_shape",
  "split_block",
  "clone_block",
  "edit_block",
  "expand_block",
  "combine_blocks",
  "bridge_blocks",
  "cluster_blocks",
  "apply_dag",
  "mark_unusable",
  "set_dynamic_effect",
  "set_generator_effect",
  "delete_block",
  "create_flow",
  "search_web",
  "attach_content",
  "add_note",
  "edit_note",
  "delete_note",
  "add_drawing_layer",
  "draw_on_layer",
  "delete_drawing_layer",
] as const;

export type HeliosMapToolId = (typeof HELIOS_MAP_TOOL_IDS)[number];

export type HeliosMapToolFamily =
  | "topologies"
  | "unusable"
  | "generative"
  | "dag"
  | "edit"
  | "research"
  | "overlay";

export type HeliosMapToolSpec = {
  id: HeliosMapToolId;
  family: HeliosMapToolFamily;
  title: string;
  description: string;
};

export const HELIOS_MAP_TOOL_CATALOG: readonly HeliosMapToolSpec[] = [
  {
    id: "add_block",
    family: "topologies",
    title: "Add block",
    description:
      "Place a new 1×1 tile. You choose the kind for this cell from TILE KINDS. Arguments: title, optional row and col (next open cell if omitted), kind (solve, verification, calibration, content — never learn). On a whole-map build, mix kinds; omit kind only for a single unspecified tile (then solve). Solve/verification/calibration: pass flowId of an OWNER FLOW, or omit flowId and pass flowName plus goal (calibration) or topic (verification or solve) to create a flow that belongs to this map then link it. Calibration/verification also take questions. Solve is name + topic only. Content takes files/links attachments and has no session.",
  },
  {
    id: "generate_shape",
    family: "topologies",
    title: "Generate in shape",
    description:
      "Create one freeform tile covering a contiguous empty-cell selection (Generate-in-shape drawer). Same kind/flow rules as add_block (default solve, create-then-link).",
  },
  {
    id: "split_block",
    family: "topologies",
    title: "Split block",
    description: "Split a multi-cell block into 1×1 cells (Split drawer).",
  },
  {
    id: "clone_block",
    family: "topologies",
    title: "Clone block",
    description: "Copy a block onto an open cell (Clone drawer).",
  },
  {
    id: "expand_block",
    family: "topologies",
    title: "Expand block",
    description:
      "Grow neighbor 1×1 blocks around a source block (Expand block drawer). New tiles reuse the source flow or content — they do not start a Learn session.",
  },
  {
    id: "combine_blocks",
    family: "topologies",
    title: "Combine blocks",
    description:
      "Merge selected blocks into one freeform footprint (Combine drawer).",
  },
  {
    id: "bridge_blocks",
    family: "topologies",
    title: "Bridge blocks",
    description:
      "Fill a 1-cell corridor of new blocks between selected anchors (Bridge drawer). Default thickness is 1 cell (width 0). width is half-width: 0 = 1 cell, 1 = 3 cells, 2 = 5 cells. New tiles reuse the first anchor's flow or content.",
  },
  {
    id: "cluster_blocks",
    family: "topologies",
    title: "Cluster blocks",
    description:
      "Relocate selected blocks into separated clusters (Cluster drawer).",
  },
  {
    id: "mark_unusable",
    family: "unusable",
    title: "Unusable ground",
    description:
      "Mark or clear empty cells as unusable ground (Unusable ground drawer).",
  },
  {
    id: "set_dynamic_effect",
    family: "generative",
    title: "Dynamic effect",
    description:
      "Enable Dynamic generative unlock-after on a block (Dynamic drawer).",
  },
  {
    id: "set_generator_effect",
    family: "generative",
    title: "Generator effect",
    description:
      "Enable Generator spawn targets on empty cells (Generator drawer).",
  },
  {
    id: "apply_dag",
    family: "dag",
    title: "Apply DAG",
    description:
      "Apply leads-to edges among selected blocks (DAG drawer).",
  },
  {
    id: "edit_block",
    family: "edit",
    title: "Edit block",
    description:
      "Update a block title, description, kind, linked flow, or content attachments (Edit drawer).",
  },
  {
    id: "delete_block",
    family: "edit",
    title: "Delete block",
    description: "Remove a block (Danger zone drawer).",
  },
  {
    id: "create_flow",
    family: "edit",
    title: "Create flow",
    description:
      "Create an owner calibration, verification, or solve flow without placing a block. Arguments: kind (calibration|verification|solve), name, goal (calibration) or topic (verification or solve). Solve is name + topic only. Prefer add_block with omitted flowId when you also need to place a tile.",
  },
  {
    id: "search_web",
    family: "research",
    title: "Search the web",
    description:
      "Find online resources for this map. Arguments: query. Summarize hits in reply and ask the author which to attach. Do not attach until they confirm unless they already named the resource.",
  },
  {
    id: "attach_content",
    family: "research",
    title: "Attach content",
    description:
      "Attach a link or file URL onto an existing content block (creates content kind if needed). Arguments: blockId, links (name+url), files (name+url downloaded into org xAI Files). Use after the author confirms a search hit.",
  },
  {
    id: "add_note",
    family: "overlay",
    title: "Add note",
    description:
      "Place a creator map post-it on the plane (same as Manual notes).",
  },
  {
    id: "edit_note",
    family: "overlay",
    title: "Edit note",
    description: "Update a map note body or position.",
  },
  {
    id: "delete_note",
    family: "overlay",
    title: "Delete note",
    description: "Remove a creator map note.",
  },
  {
    id: "add_drawing_layer",
    family: "overlay",
    title: "Add drawing layer",
    description:
      "Create a named white-stroke annotation layer (same as Manual drawing layers).",
  },
  {
    id: "draw_on_layer",
    family: "overlay",
    title: "Draw on layer",
    description:
      "Add a circle, square, or freehand stroke on a drawing layer.",
  },
  {
    id: "delete_drawing_layer",
    family: "overlay",
    title: "Delete drawing layer",
    description: "Remove a drawing layer.",
  },
] as const;

export function isHeliosMapToolId(value: unknown): value is HeliosMapToolId {
  return (
    typeof value === "string" &&
    (HELIOS_MAP_TOOL_IDS as readonly string[]).includes(value)
  );
}

export const HELIOS_RESEARCH_TOOL_IDS = ["search_web"] as const;

export function isHeliosResearchToolId(value: unknown): boolean {
  return value === "search_web";
}

export function heliosMapToolAwarenessText(
  catalog: readonly HeliosMapToolSpec[] = HELIOS_MAP_TOOL_CATALOG,
): string {
  const lines = catalog.map(
    (tool) => `- ${tool.id} [${tool.family}] ${tool.title}: ${tool.description}`,
  );
  return [
    "HELIOS LEARNING MAP BUILDER TOOLS",
    "Helios is the Learning Map builder helper. These tools match Manual Mode drawers:",
    "topologies (add/place, generate-in-shape, split, clone, expand, combine, bridge, cluster),",
    "unusable ground, generative blocks (dynamic and generator), DAGs, remaining edit/delete ops,",
    "research (search_web then attach_content), and overlay (map notes and drawing layers).",
    "add_block arguments: { \"title\": \"...\", \"row\": 0, \"col\": 0, \"kind\": \"solve\" | \"verification\" | \"calibration\" | \"content\" }. You pick kind per cell from TILE KINDS — never learn. On a whole-map build mix kinds in one turn. Solve, verification, and calibration: link an existing owner flow via flowId (see OWNER FLOWS) or omit flowId and pass flowName plus goal or topic to create then link. Calibration/verification take questions. Solve is name + topic only. Content blocks attach files/links and have no session. Default origin is row 0, col 0. Omit row/col only when that default (or the next open cell) is correct. Read CURRENT MAP occupied cells before placing.",
    "search_web arguments: { \"query\": \"...\" }. On a map-build turn, place content tiles and attach a clearly canonical source. Ask the author before attaching uncertain hits.",
    "attach_content arguments: { \"blockId\": \"...\", \"links\": [{ \"name\": \"...\", \"url\": \"https://...\" }], \"files\": [{ \"name\": \"notes.pdf\", \"url\": \"https://.../notes.pdf\" }] }.",
    "bridge_blocks arguments: { \"blockIds\": [\"id1\",\"id2\"], \"width\": 0 }. Default thickness is 1 cell (width 0). Omit width unless the author asks for a thicker corridor.",
    "apply_dag arguments: { \"blockIds\": [\"id1\",\"id2\"], \"edges\": [{ \"from\": \"id1\", \"to\": \"id2\", \"kind\": \"next\" }] }.",
    "If blockIds/edges are omitted, apply_dag uses current blocks in reading order.",
    ...lines,
  ].join("\n");
}
