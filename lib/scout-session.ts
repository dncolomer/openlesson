/**
 * Scout mode: TAP-shaped rabbit-hole mind map (no think-aloud).
 * Pure units — tree, question normalize, canvas seed/connect, thank-you CTAs,
 * prompt builder, and ILE context merge. Tests inject question arrays.
 */

import {
  convertToExcalidrawElements,
  emptyIleWorkCanvasScene,
  ileWorkCanvasLiveGeometryListing,
  ileWorkCanvasXaiToolsInstruction,
  serializeIleWorkCanvasScene,
  settleIleWorkCanvasIncoming,
  wrapIleWorkCanvasText,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
} from "@/lib/ile-work-canvas";
import type { PromptWorkspaceContextInput } from "@/lib/prompt-workspace-context";
import type { BlockPracticeOptions } from "@/lib/block-practice-options";

export const SCOUT_FOLLOWUP_QUESTION_COUNT = 3;
export const SCOUT_QUESTION_MAX_WORDS = 8;
export const SCOUT_NODE_CUSTOM_DATA_KEY = "scoutNodeId";
export const SCOUT_ROLE_CUSTOM_DATA_KEY = "scoutRole";
export const SCOUT_SEED_NODE_ID = "scout-seed";

export const SCOUT_FRAME_WIDTH = 240;
export const SCOUT_FRAME_MIN_HEIGHT = 64;
export const SCOUT_FRAME_PADDING_X = 14;
export const SCOUT_FRAME_PADDING_Y = 12;
export const SCOUT_FONT_SIZE = 16;
export const SCOUT_CHILD_GAP_Y = 48;
export const SCOUT_SEED_X = 72;
export const SCOUT_SEED_Y = 40;
/** @deprecated Horizontal layout retired; kept so older imports keep compiling. */
export const SCOUT_FRAME_HEIGHT = SCOUT_FRAME_MIN_HEIGHT;
export const SCOUT_CHILD_GAP_X = 0;

/** Scout never arms TAP think-aloud, mic, or session purity. */
export function scoutThinkAloudEnabled(): false {
  return false;
}

export function scoutSessionPurityEnabled(): false {
  return false;
}

export function scoutLiveSpeechEnabled(_phase?: string): false {
  return false;
}

export type ScoutNode = {
  id: string;
  text: string;
  parentId: string | null;
};

export type ScoutLiveState = {
  seedText: string;
  nodes: ScoutNode[];
  currentNodeId: string;
  questions: string[];
};

export type ScoutArtifacts = {
  path: string[];
  canvasText: string;
  seedText: string;
};

export type ScoutThankYouActions = {
  restart: true;
  workspace: true;
  work: boolean;
  drill: boolean;
};

function trimText(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

function newScoutNodeId(): string {
  return `scout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createScoutLiveState(seedText: string): ScoutLiveState {
  const text = trimText(seedText) || "Topic";
  return {
    seedText: text,
    nodes: [{ id: SCOUT_SEED_NODE_ID, text, parentId: null }],
    currentNodeId: SCOUT_SEED_NODE_ID,
    questions: [],
  };
}

export function scoutCurrentNode(state: ScoutLiveState): ScoutNode {
  return (
    state.nodes.find((n) => n.id === state.currentNodeId) ??
    state.nodes[0] ?? { id: SCOUT_SEED_NODE_ID, text: state.seedText, parentId: null }
  );
}

export function canGoBackScoutNode(state: ScoutLiveState): boolean {
  const current = scoutCurrentNode(state);
  return Boolean(current.parentId);
}

/** Root → current path texts (seed first). */
export function scoutPathFromRoot(state: ScoutLiveState): string[] {
  const byId = new Map(state.nodes.map((n) => [n.id, n]));
  const chain: ScoutNode[] = [];
  let cursor: ScoutNode | undefined = scoutCurrentNode(state);
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.push(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return chain.reverse().map((n) => n.text);
}

export function looksLikeScoutQuestion(raw: unknown): boolean {
  const t = trimText(raw);
  if (!t) return false;
  if (t.includes("?")) return true;
  return /^(what|why|how|when|where|which|who|whose|whom|is|are|can|could|should|would|will|do|does|did|may|might|if)\b/i.test(
    t,
  );
}

/** Keep the question; drop any answer that follows the first `?`. */
export function stripScoutAnswerTail(raw: unknown): string {
  const t = trimText(raw);
  if (!t) return "";
  const idx = t.indexOf("?");
  if (idx >= 0) return t.slice(0, idx + 1).trim();
  return t;
}

/** Keep follow-ups short enough to scan in the Prepare pane. */
export function shortenScoutQuestion(raw: unknown): string {
  const q = stripScoutAnswerTail(raw);
  if (!q) return "";
  const body = q.replace(/\?+$/g, "").trim();
  const words = body.split(/\s+/).filter(Boolean);
  const clipped = words.slice(0, SCOUT_QUESTION_MAX_WORDS).join(" ");
  if (!clipped) return q;
  return /\?$/.test(clipped) ? clipped : `${clipped}?`;
}

/**
 * Normalize raw AI / stub output into exactly `count` inquisitive questions.
 * Answers (statements without a question mark / interrogative opener) are rejected.
 */
export function normalizeScoutQuestions(
  raw: unknown,
  count: number = SCOUT_FOLLOWUP_QUESTION_COUNT,
): string[] {
  const need = Math.max(1, Math.floor(Number(count) || SCOUT_FOLLOWUP_QUESTION_COUNT));
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object" && Array.isArray((raw as { questions?: unknown }).questions)) {
    list = (raw as { questions: unknown[] }).questions;
  } else if (typeof raw === "string" && raw.trim()) {
    list = raw
      .split(/\n+/)
      .map((s) => s.replace(/^\s*[-*\d.)]+\s*/, "").trim())
      .filter(Boolean);
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const extracted =
      typeof item === "string"
        ? item
        : item && typeof item === "object" && "question" in (item as object)
          ? String((item as { question?: unknown }).question ?? "")
          : "";
    const q = shortenScoutQuestion(extracted);
    if (!looksLikeScoutQuestion(q)) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
    if (out.length >= need) break;
  }

  let pad = 1;
  while (out.length < need) {
    const fallback = `What pulls next (${pad})?`;
    if (!seen.has(fallback.toLowerCase())) {
      out.push(fallback);
      seen.add(fallback.toLowerCase());
    }
    pad += 1;
  }
  return out.slice(0, need);
}

export function receiveScoutQuestions(
  state: ScoutLiveState,
  raw: unknown,
  count: number = SCOUT_FOLLOWUP_QUESTION_COUNT,
): ScoutLiveState {
  return {
    ...state,
    questions: normalizeScoutQuestions(raw, count),
  };
}

export function pickScoutQuestion(
  state: ScoutLiveState,
  questionIndex: number,
): ScoutLiveState {
  const idx = Math.floor(Number(questionIndex));
  if (!Number.isFinite(idx) || idx < 0 || idx >= state.questions.length) {
    return state;
  }
  const picked = trimText(state.questions[idx]);
  if (!picked) return state;
  const node: ScoutNode = {
    id: newScoutNodeId(),
    text: picked,
    parentId: state.currentNodeId,
  };
  return {
    ...state,
    nodes: [...state.nodes, node],
    currentNodeId: node.id,
    questions: [],
  };
}

export function goBackScoutNode(state: ScoutLiveState): ScoutLiveState {
  const current = scoutCurrentNode(state);
  if (!current.parentId) return state;
  const parent = state.nodes.find((n) => n.id === current.parentId);
  if (!parent) return state;
  return {
    ...state,
    currentNodeId: parent.id,
    questions: [],
  };
}

export function buildScoutQuestionsSystemMessage(
  count: number = SCOUT_FOLLOWUP_QUESTION_COUNT,
): string {
  const n = Math.max(1, Math.floor(Number(count) || SCOUT_FOLLOWUP_QUESTION_COUNT));
  return `You generate rabbit-hole follow-up QUESTIONS for a Prepare (Scout) mind-map session.
Return ONLY JSON: { "questions": [ "...", ... ] } with exactly ${n} distinct questions.
Rules:
- Each item is a short inquisitive question (never an answer, never a lecture, never a definition).
- Dig into where pull and interest are strongest on the seed topic and the current canvas/path.
- Keep each option 3–8 words. Easy to scan. End with a question mark.
- Examples: "Where does this break?", "Who pays the cost?", "What if we invert it?"
- No numbering, no markdown, no product jargon.
- Do not repeat questions already on the path or canvas.
- Do not explain or answer — only ask.`;
}

export function buildScoutQuestionsUserPrompt(input: {
  seedTitle?: string | null;
  seedDescription?: string | null;
  path?: readonly string[] | null;
  canvasText?: string | null;
  scene?: IleWorkCanvasScene | { elements?: unknown } | null;
  currentNode?: string | null;
  count?: number;
}): string {
  const n = Math.max(
    1,
    Math.floor(Number(input.count) || SCOUT_FOLLOWUP_QUESTION_COUNT),
  );
  const title = trimText(input.seedTitle) || "Untitled topic";
  const description = trimText(input.seedDescription);
  const path = (input.path || []).map((p) => trimText(p)).filter(Boolean);
  const canvasText = trimText(input.canvasText);
  const current = trimText(input.currentNode) || path[path.length - 1] || title;
  const geometry = input.scene ? ileWorkCanvasLiveGeometryListing(input.scene) : "";
  const lines = [
    `Seed topic: "${title}"`,
    description ? `Seed description: ${description}` : null,
    `Current canvas node: "${current}"`,
    path.length > 0
      ? `Path from seed to current (deepest last):\n${path.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
      : "Path: (none yet — generate the initial set of open exploration questions on the seed topic)",
    geometry
      ? `Live Work canvas geometry (every non-deleted element):\n${geometry}`
      : canvasText
        ? `Text already on the Work canvas (includes manual learner edits):\n${canvasText}`
        : "Work canvas: seed only so far.",
    canvasText && geometry
      ? `Text already on the Work canvas (includes manual learner edits):\n${canvasText}`
      : null,
    ileWorkCanvasXaiToolsInstruction(),
    `Generate exactly ${n} ${path.length <= 1 ? "opening" : "follow-up"} question(s). Short (3–8 words). Questions only — no answers.`,
  ].filter(Boolean);
  return lines.join("\n");
}

function scoutElementNodeId(el: IleWorkCanvasElement): string | null {
  const id = el.customData?.[SCOUT_NODE_CUSTOM_DATA_KEY];
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function findScoutCanvasFrame(
  scene: IleWorkCanvasScene | null | undefined,
  nodeId: string,
): IleWorkCanvasElement | null {
  const id = trimText(nodeId);
  if (!id) return null;
  const live = (scene?.elements || []).filter((el) => !el.isDeleted);
  return (
    live.find((el) => el.type === "rectangle" && scoutElementNodeId(el) === id) ||
    live.find((el) => scoutElementNodeId(el) === id) ||
    null
  );
}

export function extractScoutCanvasText(
  scene: IleWorkCanvasScene | null | undefined,
): string {
  const parts: string[] = [];
  for (const el of scene?.elements || []) {
    if (el.isDeleted) continue;
    const text = trimText(el.originalText || el.text);
    if (text) parts.push(text);
  }
  return parts.join("\n");
}

export function scoutFrameMetrics(text: string): {
  width: number;
  height: number;
  innerWidth: number;
  wrappedText: string;
  fontSize: number;
} {
  const innerWidth = SCOUT_FRAME_WIDTH - SCOUT_FRAME_PADDING_X * 2;
  const wrapped = wrapIleWorkCanvasText(
    trimText(text) || "Topic",
    innerWidth,
    SCOUT_FONT_SIZE,
  );
  return {
    width: SCOUT_FRAME_WIDTH,
    height: Math.max(
      SCOUT_FRAME_MIN_HEIGHT,
      wrapped.height + SCOUT_FRAME_PADDING_Y * 2,
    ),
    innerWidth,
    wrappedText: wrapped.text,
    fontSize: SCOUT_FONT_SIZE,
  };
}

function framedScoutNodeSkeletons(input: {
  text: string;
  nodeId: string;
  role: "seed" | "pick";
  x: number;
  y: number;
  parentNodeId?: string | null;
}): Parameters<typeof convertToExcalidrawElements>[0] {
  const label = trimText(input.text) || "Topic";
  const box = scoutFrameMetrics(label);
  const custom = {
    [SCOUT_NODE_CUSTOM_DATA_KEY]: input.nodeId,
    [SCOUT_ROLE_CUSTOM_DATA_KEY]: input.role,
    scoutParentId: input.parentNodeId ?? null,
  };
  return [
    {
      type: "rectangle",
      x: input.x,
      y: input.y,
      width: box.width,
      height: box.height,
      backgroundColor: "transparent",
      strokeColor: "#e5e5e5",
      strokeWidth: 2,
      customData: custom,
    },
    {
      type: "text",
      text: label,
      x: input.x + SCOUT_FRAME_PADDING_X,
      y: input.y + SCOUT_FRAME_PADDING_Y,
      width: box.innerWidth,
      height: box.height - SCOUT_FRAME_PADDING_Y * 2,
      fontSize: box.fontSize,
      autoResize: false,
      textAlign: "center",
      verticalAlign: "middle",
      customData: {
        ...custom,
        [SCOUT_ROLE_CUSTOM_DATA_KEY]: `${input.role}-label`,
      },
    },
  ];
}

function bindScoutFrameText(elements: IleWorkCanvasElement[]): IleWorkCanvasElement[] {
  const rect = elements.find((el) => el.type === "rectangle" && !el.isDeleted);
  const text = elements.find((el) => el.type === "text" && !el.isDeleted);
  if (!rect || !text) return elements;
  const innerW = Math.max(24, rect.width - SCOUT_FRAME_PADDING_X * 2);
  const innerH = Math.max(24, rect.height - SCOUT_FRAME_PADDING_Y * 2);
  text.containerId = rect.id;
  text.autoResize = false;
  text.textAlign = "center";
  text.verticalAlign = "middle";
  text.fontSize = SCOUT_FONT_SIZE;
  text.width = innerW;
  text.height = innerH;
  text.x = rect.x + SCOUT_FRAME_PADDING_X;
  text.y = rect.y + SCOUT_FRAME_PADDING_Y;
  const wrapped = wrapIleWorkCanvasText(
    String(text.originalText || text.text || ""),
    innerW,
    SCOUT_FONT_SIZE,
  );
  text.text = wrapped.text;
  text.originalText = wrapped.originalText;
  rect.boundElements = [{ type: "text", id: text.id }];
  return elements;
}

function scoutChildRectangles(
  scene: IleWorkCanvasScene,
  parentNodeId: string,
): IleWorkCanvasElement[] {
  return scene.elements.filter(
    (el) =>
      !el.isDeleted &&
      el.type === "rectangle" &&
      el.customData?.scoutParentId === parentNodeId,
  );
}

function nextScoutChildOrigin(
  scene: IleWorkCanvasScene,
  parent: Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height">,
  parentNodeId: string,
): { x: number; y: number } {
  const siblings = scoutChildRectangles(scene, parentNodeId);
  let y = parent.y + parent.height + SCOUT_CHILD_GAP_Y;
  for (const sib of siblings) {
    y = Math.max(y, sib.y + sib.height + SCOUT_CHILD_GAP_Y);
  }
  return { x: parent.x, y };
}

/** Seed the shared Work canvas with the topic as framed text. */
export function seedScoutWorkCanvas(seedText: string): {
  scene: IleWorkCanvasScene;
  nodeId: string;
} {
  const text = trimText(seedText) || "Topic";
  const converted = bindScoutFrameText(
    convertToExcalidrawElements(
      framedScoutNodeSkeletons({
        text,
        nodeId: SCOUT_SEED_NODE_ID,
        role: "seed",
        x: SCOUT_SEED_X,
        y: SCOUT_SEED_Y,
      }),
    ),
  );
  const empty = emptyIleWorkCanvasScene();
  return {
    scene: serializeIleWorkCanvasScene({
      elements: converted,
      appState: empty.appState,
      files: empty.files,
    }),
    nodeId: SCOUT_SEED_NODE_ID,
  };
}

/**
 * Add a picked follow-up as a framed node connected (arrow) to the current canvas node.
 */
export function connectScoutQuestionToCanvas(
  scene: IleWorkCanvasScene | null | undefined,
  input: {
    question: string;
    nodeId?: string;
    parentNodeId: string;
  },
): { scene: IleWorkCanvasScene; nodeId: string; added: IleWorkCanvasElement[] } {
  const current = serializeIleWorkCanvasScene(scene);
  const question = trimText(input.question);
  const nodeId = trimText(input.nodeId) || newScoutNodeId();
  if (!question) return { scene: current, nodeId, added: [] };

  const parent = findScoutCanvasFrame(current, input.parentNodeId);
  const parentX = parent?.x ?? SCOUT_SEED_X;
  const parentY = parent?.y ?? SCOUT_SEED_Y;
  const parentW = parent?.width ?? SCOUT_FRAME_WIDTH;
  const parentH = parent?.height ?? SCOUT_FRAME_MIN_HEIGHT;
  const origin = nextScoutChildOrigin(
    current,
    { x: parentX, y: parentY, width: parentW, height: parentH },
    input.parentNodeId,
  );
  const x = origin.x;
  const y = origin.y;

  const nodeEls = bindScoutFrameText(
    convertToExcalidrawElements(
      framedScoutNodeSkeletons({
        text: question,
        nodeId,
        role: "pick",
        x,
        y,
        parentNodeId: input.parentNodeId,
      }),
    ),
  );
  const child = nodeEls.find((el) => el.type === "rectangle") ?? nodeEls[0];
  const childW = child?.width ?? SCOUT_FRAME_WIDTH;
  const fromX = parentX + parentW / 2;
  const fromY = parentY + parentH;
  const toX = x + childW / 2;
  const toY = y;
  const arrowEls = convertToExcalidrawElements([
    {
      type: "arrow",
      x: fromX,
      y: fromY,
      width: toX - fromX,
      height: toY - fromY,
      strokeColor: "#a3a3a3",
      customData: {
        scoutEdge: true,
        scoutFrom: input.parentNodeId,
        scoutTo: nodeId,
      },
    },
  ]);

  const added = settleIleWorkCanvasIncoming(
    [...nodeEls, ...arrowEls],
    current.elements.filter((el) => !el.isDeleted),
  );
  return {
    scene: serializeIleWorkCanvasScene({
      elements: [...current.elements, ...added],
      appState: current.appState,
      files: current.files,
    }),
    nodeId,
    added,
  };
}

export function scoutThankYouActions(input: {
  allowExplore?: boolean | null;
  allowDrill?: boolean | null;
  practiceOptions?: BlockPracticeOptions | null;
}): ScoutThankYouActions {
  const allowExplore =
    input.practiceOptions != null
      ? input.practiceOptions.allowExplore
      : input.allowExplore !== false;
  const allowDrill =
    input.practiceOptions != null
      ? input.practiceOptions.allowDrill
      : input.allowDrill === true;
  return {
    restart: true,
    workspace: true,
    work: Boolean(allowExplore),
    drill: Boolean(allowDrill),
  };
}

export function formatScoutArtifactsForPrompt(
  artifacts: ScoutArtifacts | null | undefined,
): string {
  if (!artifacts) return "";
  const path = (artifacts.path || []).map((p) => trimText(p)).filter(Boolean);
  const canvasText = trimText(artifacts.canvasText);
  const seed = trimText(artifacts.seedText);
  if (!path.length && !canvasText && !seed) return "";
  const lines = ["## Scout mind map (prior Scout session on this block)"];
  if (seed) lines.push(`Scout seed: ${seed}`);
  if (path.length) {
    lines.push(
      `Scout path (interest pull, deepest last):\n${path.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
    );
  }
  if (canvasText) {
    lines.push(`Scout Work canvas text:\n${canvasText}`);
  }
  return lines.join("\n");
}

export function parseScoutArtifacts(raw: unknown): ScoutArtifacts | null {
  if (raw == null || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const path = Array.isArray(rec.path)
    ? rec.path.map((p) => trimText(p)).filter(Boolean)
    : Array.isArray(rec.scout_path)
      ? rec.scout_path.map((p) => trimText(p)).filter(Boolean)
      : [];
  const canvasText = trimText(rec.canvasText ?? rec.canvas_text ?? rec.scoutCanvasText);
  const seedText = trimText(rec.seedText ?? rec.seed_text ?? rec.scoutSeed);
  if (!path.length && !canvasText && !seedText) return null;
  return { path, canvasText, seedText };
}

export function parseScoutArtifactsFromPowMetadata(
  metadata: unknown,
): ScoutArtifacts | null {
  if (metadata == null || typeof metadata !== "object") return null;
  const rec = metadata as Record<string, unknown>;
  const nested =
    rec.scout && typeof rec.scout === "object"
      ? (rec.scout as Record<string, unknown>)
      : rec;
  if (rec.scout_session !== true && nested.scout_session !== true && !nested.path && !rec.scout_path) {
    const parsed = parseScoutArtifacts({
      path: rec.scout_path ?? nested.path,
      canvasText: rec.scout_canvas_text ?? nested.canvasText,
      seedText: rec.scout_seed ?? nested.seedText,
    });
    return parsed;
  }
  return parseScoutArtifacts({
    path: rec.scout_path ?? nested.path,
    canvasText: rec.scout_canvas_text ?? nested.canvasText ?? nested.canvas_text,
    seedText: rec.scout_seed ?? nested.seedText ?? nested.seed_text,
  });
}

/** Merge later Scout runs; later rows win on seed, paths concatenate uniquely. */
export function collectScoutArtifactsFromPowRows(
  rows: ReadonlyArray<{ metadata?: unknown } | null | undefined> | null | undefined,
): ScoutArtifacts | null {
  let seedText = "";
  let canvasText = "";
  const path: string[] = [];
  const seen = new Set<string>();
  for (const row of rows || []) {
    const parsed = parseScoutArtifactsFromPowMetadata(row?.metadata);
    if (!parsed) continue;
    if (parsed.seedText) seedText = parsed.seedText;
    if (parsed.canvasText) canvasText = parsed.canvasText;
    for (const step of parsed.path) {
      const key = step.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      path.push(step);
    }
  }
  if (!path.length && !canvasText && !seedText) return null;
  return { path, canvasText, seedText };
}

export function buildScoutCanvasPowMetadata(input: {
  path?: readonly string[] | null;
  seedText?: string | null;
  canvasText?: string | null;
}): Record<string, unknown> {
  return {
    scout_session: true,
    scout_path: (input.path || []).map((p) => trimText(p)).filter(Boolean),
    scout_seed: trimText(input.seedText),
    scout_canvas_text: trimText(input.canvasText),
  };
}

export function mergeScoutArtifactsIntoPromptInput(
  input: PromptWorkspaceContextInput,
  artifacts: ScoutArtifacts | null | undefined,
): PromptWorkspaceContextInput {
  if (!artifacts) return input;
  const formatted = formatScoutArtifactsForPrompt(artifacts);
  if (!formatted) return input;
  const extra = [trimText(input.extra), formatted].filter(Boolean).join("\n\n");
  return {
    ...input,
    extra: extra || undefined,
    scoutArtifacts: artifacts,
  };
}

export function scoutArtifactsFromLive(
  state: ScoutLiveState,
  scene?: IleWorkCanvasScene | null,
): ScoutArtifacts {
  return {
    path: scoutPathFromRoot(state),
    canvasText: extractScoutCanvasText(scene),
    seedText: state.seedText,
  };
}

export function buildScoutCompleteTranscript(state: ScoutLiveState): Array<{
  role: "assistant" | "user";
  text: string;
  at: string;
}> {
  const at = new Date().toISOString();
  const path = scoutPathFromRoot(state);
  const out: Array<{ role: "assistant" | "user"; text: string; at: string }> = [
    { role: "assistant", text: `Scout: ${state.seedText}`, at },
  ];
  for (const step of path.slice(1)) {
    out.push({ role: "user", text: step, at });
  }
  return out;
}
