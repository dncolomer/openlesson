/**
 * Work-canvas prompt text: drawing-tool instruction, domain prefix, and command user messages.
 * Leaf module. Types from the scene module are erased at runtime.
 */
import {
  assemblePromptWorkspaceContext,
  type PromptWorkspaceContext,
  type PromptWorkspaceContextInput,
} from "@/lib/prompt-workspace-context";
import type { IleWorkCanvasElement, IleWorkCanvasScene } from "@/lib/ile-work-canvas";
import type { IleWorkCanvasAskKind } from "@/lib/ile-work-canvas-commands";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

/** Excalidraw drawing tools that map to TAP Learning Work PoW. */
export const ILE_EXCALIDRAW_POW_TOOLS = [
  "text",
  "freedraw",
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "image",
  "eraser",
  "frame",
  "selection",
] as const;

export type IleExcalidrawPowTool = (typeof ILE_EXCALIDRAW_POW_TOOLS)[number];

/** Scene primitives XAI may emit in JSON "elements" (eraser/selection are learner-only). */
export const ILE_XAI_CANVAS_SHAPE_TYPES = [
  "text",
  "freedraw",
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "frame",
  "image",
] as const;

export type IleXaiCanvasShapeType = (typeof ILE_XAI_CANVAS_SHAPE_TYPES)[number];

/** Turn + system instruction: tools on the board and how to draw them in JSON. */
export function ileWorkCanvasXaiToolsInstruction(): string {
  const tools = ILE_EXCALIDRAW_POW_TOOLS.join(", ");
  const shapes = ILE_XAI_CANVAS_SHAPE_TYPES.filter((type) => type !== "image").join(", ");
  return [
    `EXCALIDRAW DRAWING TOOLS on this board (name these when routing work): ${tools}.`,
    `A schematic is rare. Add JSON "elements" (types: ${shapes}) only when a diagram is truly necessary: the topic is spatial, structural, geometric, or a relationship the learner cannot see from sentences.`,
    `For an ordinary explanation, definition, question, or worked step, omit "elements" or send an empty array. Do not draw a flowchart, box diagram, or extra shape by default.`,
    "Skip eraser and selection — those are learner tools only. Skip image unless you already have a fileId.",
    `Reply as JSON: {"text":"<coaching reply, also placed as a text block>","textWidth":number,"origin":{"x":number,"y":number},"elements":[]}.`,
    `"text" is what the learner reads on the board. Write it as a wise, warm teacher: complete unhurried sentences, eloquent and plain, easy to start from, with no headings, bullets, or compressed exam stems. Do not put JSON, code fences, or element arrays inside "text".`,
    `"textWidth" is the coaching text box width in pixels. Choose it for this reply so the box fits the cluster. Do not reuse one width every time. A text element may set its own "width" the same way.`,
    `Include "elements" only for that necessary diagram (${shapes}). Arrows/lines/freedraw may include "points":[[x,y],...]. Labeled shapes use "label":{"text":"..."}. Place marks near related existing elements. Always include "text". Never mention this JSON format to the learner.`,
  ].join(" ");
}

export function ileWorkCanvasSelectionSummary(
  elements: readonly IleWorkCanvasElement[] | null | undefined,
): string {
  const live = (elements ?? []).filter((el) => !el.isDeleted);
  if (!live.length) return "(none)";
  return live
    .map((el) => {
      if (el.type === "text" && el.text) {
        const text = String(el.text).replace(/\s+/g, " ").trim().slice(0, 280);
        return `[text] ${text}`;
      }
      return `[${el.type}] at (${Math.round(el.x)}, ${Math.round(el.y)})`;
    })
    .join("\n");
}

export type IleWorkCanvasWorkspaceInput = PromptWorkspaceContextInput;

/** Stay-on-domain line attached to seed/ask/turn prompts so XAI does not drift. */
export const ILE_WORK_CANVAS_STAY_ON_DOMAIN =
  "Stay on this workspace and focused-block domain. Do not invent unrelated topics.";

export function ileWorkCanvasWorkspaceFromChatBody(body: {
  workspaceContext?: unknown;
  workspaceTitle?: unknown;
  workspaceGoal?: unknown;
  workspaceDescription?: unknown;
  blockTitle?: unknown;
  blockDescription?: unknown;
  chapterDescription?: unknown;
  activeStepDescription?: unknown;
  problem?: unknown;
  notes?: unknown;
  focusedBlockId?: unknown;
  rootTopic?: unknown;
} | null | undefined): PromptWorkspaceContextInput {
  const rec = asRecord(body);
  const nested = asRecord(rec.workspaceContext);
  const str = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const t = value.replace(/\s+/g, " ").trim();
    return t || null;
  };
  const pick = (key: string, fallback?: unknown): string | null =>
    str(nested[key]) || str(rec[key]) || str(fallback);
  const files = Array.isArray(nested.files)
    ? nested.files
    : Array.isArray(rec.files)
      ? rec.files
      : undefined;
  const blocks = Array.isArray(nested.blocks)
    ? nested.blocks
    : Array.isArray(rec.blocks)
      ? rec.blocks
      : undefined;
  const unusableCells = Array.isArray(nested.unusableCells)
    ? nested.unusableCells
    : Array.isArray(rec.unusableCells)
      ? rec.unusableCells
      : undefined;
  const blockLocalContext = nested.blockLocalContext ?? rec.blockLocalContext ?? undefined;
  return {
    workspaceTitle: pick("workspaceTitle", rec.problem),
    rootTopic: pick("rootTopic"),
    workspaceGoal: pick("workspaceGoal"),
    workspaceDescription: pick("workspaceDescription"),
    notes: pick("notes"),
    blockTitle: pick("blockTitle"),
    blockDescription: pick("blockDescription"),
    chapterDescription: pick("chapterDescription", rec.activeStepDescription),
    focusedBlockId: pick("focusedBlockId"),
    files: files as PromptWorkspaceContextInput["files"],
    blocks: blocks as PromptWorkspaceContextInput["blocks"],
    blockLocalContext: blockLocalContext as PromptWorkspaceContextInput["blockLocalContext"],
    unusableCells: unusableCells as PromptWorkspaceContextInput["unusableCells"],
    scoutArtifacts:
      (nested.scoutArtifacts as PromptWorkspaceContextInput["scoutArtifacts"]) ??
      (rec.scoutArtifacts as PromptWorkspaceContextInput["scoutArtifacts"]) ??
      null,
  };
}

export function ileWorkCanvasDomainContextBlock(
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null,
): string {
  if (!workspace) return "";
  const assembled =
    "contextBlock" in workspace && typeof workspace.contextBlock === "string"
      ? workspace
      : assemblePromptWorkspaceContext(workspace);
  const trimmed = String(assembled.contextBlock || "").trim();
  if (!trimmed) return "";
  if (trimmed.includes(ILE_WORK_CANVAS_STAY_ON_DOMAIN)) return trimmed;
  return `${trimmed}\n${ILE_WORK_CANVAS_STAY_ON_DOMAIN}`;
}

export function ileWorkCanvasWithDomainPrefix(
  body: string,
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null,
): string {
  const domain = ileWorkCanvasDomainContextBlock(workspace);
  if (!domain) return body;
  return `${domain}\n\n${body}`;
}

export function buildIleWorkCanvasAskUserMessage(input: {
  prompt: string;
  selectedElements?: readonly IleWorkCanvasElement[] | null;
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null;
}): string {
  const prompt = String(input.prompt || "").trim();
  const live = (input.selectedElements ?? []).filter((el) => !el.isDeleted);
  const body = !live.length
    ? `Ask about the Work canvas.\n\nQuestion:\n${prompt}`
    : `Ask about the selected Work canvas elements.\n\nQuestion:\n${prompt}\n\nSelected elements:\n${ileWorkCanvasSelectionSummary(live)}`;
  return ileWorkCanvasWithDomainPrefix(body, input.workspace);
}

export const ILE_COMPRESS_WORK_PROMPT =
  "Compress this Work canvas into one concise knowledge summary. Distill every mark, note, and relation into a single dense takeaway. Stay on the workspace/block domain. Do not invent unrelated topics.";

function ileWorkCanvasCommandSelectionListing(
  elements: readonly IleWorkCanvasElement[] | null | undefined,
): string {
  const live = (elements ?? []).filter((el) => el && !el.isDeleted);
  if (!live.length) return "(none)";
  return live
    .map((el) => {
      const text = String(el.originalText || el.text || "").replace(/\s+/g, " ").trim();
      const head = `id=${el.id} type=${el.type} x=${Math.round(Number(el.x) || 0)} y=${Math.round(Number(el.y) || 0)}`;
      return text ? `${head} text=${JSON.stringify(text)}` : head;
    })
    .join("\n");
}

export function buildIleWorkCanvasSelectiveCompressUserMessage(input: {
  selectedElements?: readonly IleWorkCanvasElement[] | null;
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null;
}): string {
  const live = (input.selectedElements ?? []).filter((el) => el && !el.isDeleted);
  const body = [
    "Compress only the selected Work canvas marks into one dense knowledge summary.",
    "Distill those marks into a single takeaway that preserves their essential claims and relations.",
    "The summary replaces only the selected marks. Every unselected mark stays in place.",
    "Do not add new topics.",
    "",
    "Selected elements:",
    ileWorkCanvasCommandSelectionListing(live),
  ].join("\n");
  return ileWorkCanvasWithDomainPrefix(body, input.workspace);
}

export function buildIleWorkCanvasRefactorUserMessage(input: {
  selectedElements?: readonly IleWorkCanvasElement[] | null;
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null;
}): string {
  const live = (input.selectedElements ?? []).filter((el) => el && !el.isDeleted);
  const body = [
    "Refactor the selected Work canvas marks.",
    "Rephrase each selected mark in different words that keep the same meaning, and give each mark a new position so the selection reads as a clearer layout.",
    "Change both the wording and the positions. Leave every unselected mark unchanged.",
    "Return JSON only, with no markdown:",
    '{"elements":[{"id":"<id>","text":"<rephrased words>","x":0,"y":0}]}',
    "Include every selected id. Do not include unselected ids.",
    "",
    "Selected elements:",
    ileWorkCanvasCommandSelectionListing(live),
  ].join("\n");
  return ileWorkCanvasWithDomainPrefix(body, input.workspace);
}

export function buildIleWorkCanvasSuggestInsightUserMessage(input: {
  selectedElements?: readonly IleWorkCanvasElement[] | null;
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null;
}): string {
  const live = (input.selectedElements ?? []).filter((el) => el && !el.isDeleted);
  const body = [
    "Suggest one insight from the selected Work canvas marks.",
    "Write a single sentence the learner could later craft as an insight. It is only a suggestion placed on the canvas.",
    "Do not evaluate it, do not save it, and do not submit it.",
    "Leave the selected marks unchanged.",
    "",
    "Selected elements:",
    ileWorkCanvasCommandSelectionListing(live),
  ].join("\n");
  return ileWorkCanvasWithDomainPrefix(body, input.workspace);
}

export function buildIleWorkCanvasAnswerUserMessage(input: {
  selectedElements?: readonly IleWorkCanvasElement[] | null;
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null;
}): string {
  const live = (input.selectedElements ?? []).filter((el) => el && !el.isDeleted);
  const body = [
    "Answer the selected question texts.",
    "The learner wrote these questions on the canvas. Answer them in complete, unhurried sentences.",
    "Leave the selected questions in place. The answer is the reply text.",
    "Do not repeat the questions.",
    "",
    "Selected elements:",
    ileWorkCanvasCommandSelectionListing(live),
  ].join("\n");
  return ileWorkCanvasWithDomainPrefix(body, input.workspace);
}

export function buildIleWorkCanvasSimplifyUserMessage(input: {
  selectedElements?: readonly IleWorkCanvasElement[] | null;
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null;
}): string {
  const live = (input.selectedElements ?? []).filter((el) => el && !el.isDeleted);
  const body = [
    "Simplify the selected text.",
    "Rewrite it in shorter, plainer sentences a learner can follow on a first read. Keep the same meaning.",
    "Leave the selected marks in place. The simpler wording is the reply text.",
    "",
    "Selected elements:",
    ileWorkCanvasCommandSelectionListing(live),
  ].join("\n");
  return ileWorkCanvasWithDomainPrefix(body, input.workspace);
}

export function buildIleWorkCanvasClearOverlapsUserMessage(input: {
  selectedElements?: readonly IleWorkCanvasElement[] | null;
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null;
}): string {
  const live = (input.selectedElements ?? []).filter((el) => el && !el.isDeleted);
  const body = [
    "The selected marks overlap and a local layout could not separate them.",
    "Return new positions only so the boxes no longer touch. Keep each mark's text and type.",
    "Do not rephrase. Do not add or remove marks.",
    "Return JSON only:",
    '{"elements":[{"id":"<id>","x":0,"y":0}]}',
    "",
    "Selected elements:",
    ileWorkCanvasCommandSelectionListing(live),
  ].join("\n");
  return ileWorkCanvasWithDomainPrefix(body, input.workspace);
}

export function buildIleWorkCanvasCommandUserMessage(input: {
  kind?: IleWorkCanvasAskKind | "compress" | null;
  prompt?: string | null;
  selectedElements?: readonly IleWorkCanvasElement[] | null;
  scene?: IleWorkCanvasScene | null;
  workspace?: PromptWorkspaceContextInput | PromptWorkspaceContext | null;
}): string {
  const kind = input.kind === "compress" ? "selective-compress" : input.kind;
  if (kind === "selective-compress") {
    return buildIleWorkCanvasSelectiveCompressUserMessage(input);
  }
  if (kind === "refactor") return buildIleWorkCanvasRefactorUserMessage(input);
  if (kind === "suggest-insight") return buildIleWorkCanvasSuggestInsightUserMessage(input);
  if (kind === "clear-overlaps") return buildIleWorkCanvasClearOverlapsUserMessage(input);
  if (kind === "answer") return buildIleWorkCanvasAnswerUserMessage(input);
  if (kind === "simplify") return buildIleWorkCanvasSimplifyUserMessage(input);
  return buildIleWorkCanvasAskUserMessage({
    prompt: String(input.prompt || ""),
    selectedElements: input.selectedElements,
    workspace: input.workspace,
  });
}
