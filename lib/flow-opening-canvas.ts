/**
 * Author-prepared Work canvas stored on a knowledge verification protocol.
 */

import {
  ileWorkCanvasCompactListing,
  ileWorkCanvasHasLiveElements,
  serializeIleWorkCanvasScene,
  withIleWorkCanvasGridAppState,
  type IleWorkCanvasAppState,
  type IleWorkCanvasChrome,
  type IleWorkCanvasScene,
} from "@/lib/learn-work-canvas";

export const FLOW_OPENING_CANVAS_LABEL = "Manually prepare the canvas";

export function flowShowsOpeningCanvas(_kind?: string | null): boolean {
  return true;
}

export function parseFlowOpeningCanvasScene(
  value: unknown,
): IleWorkCanvasScene | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;
    try {
      return parseFlowOpeningCanvasScene(JSON.parse(text) as unknown);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object") return null;
  const scene = serializeIleWorkCanvasScene(value as IleWorkCanvasScene);
  if (!ileWorkCanvasHasLiveElements(scene)) return null;
  return scene;
}

export function parseFlowOpeningCanvasSceneForKind(
  _kind: string | null | undefined,
  value: unknown,
): IleWorkCanvasScene | null {
  return parseFlowOpeningCanvasScene(value);
}

export function serializeFlowOpeningCanvasScene(
  scene: unknown,
): IleWorkCanvasScene | null {
  return parseFlowOpeningCanvasScene(scene);
}

export function flowOpeningCanvasHasContent(
  scene: IleWorkCanvasScene | null | undefined,
): boolean {
  return ileWorkCanvasHasLiveElements(parseFlowOpeningCanvasScene(scene));
}

/** Visible note / label copy from the prepared board. */
export function flowOpeningCanvasExtractText(
  scene: IleWorkCanvasScene | null | undefined,
): string {
  const parsed = parseFlowOpeningCanvasScene(scene);
  if (!parsed) return "";
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const el of parsed.elements) {
    if (!el || el.isDeleted) continue;
    const text = String(el.originalText || el.text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    lines.push(text);
  }
  return lines.join("\n");
}

export function flowOpeningCanvasListing(
  scene: IleWorkCanvasScene | null | undefined,
): string {
  const parsed = parseFlowOpeningCanvasScene(scene);
  if (!parsed) return "";
  const listing = ileWorkCanvasCompactListing(parsed);
  return listing === "(no live elements)" ? "" : listing;
}

/** Material the Unsys generator should treat as the problem when a board exists. */
export function flowOpeningCanvasGenerateProblem(
  scene: IleWorkCanvasScene | null | undefined,
): string {
  const extracted = flowOpeningCanvasExtractText(scene);
  if (extracted) return extracted;
  return flowOpeningCanvasListing(scene);
}

function openingCanvasAppState(
  scene: IleWorkCanvasScene,
  chrome: IleWorkCanvasChrome | null | undefined,
  zenModeEnabled: boolean,
) {
  const appState: IleWorkCanvasAppState = { ...scene.appState, zenModeEnabled };
  if (typeof chrome?.gridModeEnabled === "boolean") {
    appState.gridModeEnabled = chrome.gridModeEnabled;
  }
  if (chrome?.currentItemStrokeColor) {
    appState.currentItemStrokeColor = chrome.currentItemStrokeColor;
  }
  return withIleWorkCanvasGridAppState(appState, { chrome });
}

export function authoringOpeningCanvasScene(
  scene: IleWorkCanvasScene | null | undefined,
  chrome?: IleWorkCanvasChrome | null,
): IleWorkCanvasScene {
  const next = serializeIleWorkCanvasScene(scene);
  return {
    ...next,
    appState: openingCanvasAppState(next, chrome, false),
  };
}

export function learnerOpeningCanvasScene(
  scene: IleWorkCanvasScene | null | undefined,
  chrome?: IleWorkCanvasChrome | null,
): IleWorkCanvasScene {
  const next = serializeIleWorkCanvasScene(scene);
  const zen =
    typeof chrome?.zenModeEnabled === "boolean" ? chrome.zenModeEnabled : true;
  return {
    ...next,
    appState: openingCanvasAppState(next, chrome, zen),
  };
}

/**
 * Seed the learner board with a saved prepared scene.
 * No-op when the board already has work, or when no prepared scene exists.
 */
export function seedPreparedOpeningCanvas(
  current: IleWorkCanvasScene | null | undefined,
  prepared: IleWorkCanvasScene | null | undefined,
  chrome?: IleWorkCanvasChrome | null,
): { scene: IleWorkCanvasScene; seeded: boolean } {
  const live = serializeIleWorkCanvasScene(current);
  if (ileWorkCanvasHasLiveElements(live)) return { scene: live, seeded: false };
  const next = parseFlowOpeningCanvasScene(prepared);
  if (!next) return { scene: live, seeded: false };
  return { scene: learnerOpeningCanvasScene(next, chrome), seeded: true };
}

export function productFlowPublishTopicFromOpeningCanvas(input: {
  problem: string;
  name: string;
  scene: IleWorkCanvasScene | null | undefined;
}): string {
  const problem = String(input.problem || "").trim();
  if (problem) return problem;
  const extracted = flowOpeningCanvasExtractText(input.scene);
  if (extracted) return extracted;
  if (flowOpeningCanvasHasContent(input.scene)) {
    return String(input.name || "").trim();
  }
  return "";
}
