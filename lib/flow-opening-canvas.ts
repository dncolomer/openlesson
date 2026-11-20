/**
 * Author-prepared Work canvas stored on Solve / Verification flows.
 * Calibration has no Work canvas.
 */

import {
  ileWorkCanvasCompactListing,
  ileWorkCanvasHasLiveElements,
  serializeIleWorkCanvasScene,
  withIleWorkCanvasGridAppState,
  type IleWorkCanvasScene,
} from "@/lib/learn-work-canvas";

export const FLOW_OPENING_CANVAS_LABEL = "Manually prepare the canvas";

export function flowShowsOpeningCanvas(kind: string | null | undefined): boolean {
  return kind === "solve" || kind === "verification";
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
  kind: string | null | undefined,
  value: unknown,
): IleWorkCanvasScene | null {
  if (!flowShowsOpeningCanvas(kind)) return null;
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

export function authoringOpeningCanvasScene(
  scene: IleWorkCanvasScene | null | undefined,
): IleWorkCanvasScene {
  const next = serializeIleWorkCanvasScene(scene);
  return {
    ...next,
    appState: withIleWorkCanvasGridAppState({
      ...next.appState,
      zenModeEnabled: false,
    }),
  };
}

export function learnerOpeningCanvasScene(
  scene: IleWorkCanvasScene | null | undefined,
): IleWorkCanvasScene {
  const next = serializeIleWorkCanvasScene(scene);
  return {
    ...next,
    appState: withIleWorkCanvasGridAppState({
      ...next.appState,
      zenModeEnabled: true,
    }),
  };
}

/**
 * Seed the learner board with a saved prepared scene.
 * No-op when the board already has work, or when no prepared scene exists.
 */
export function seedPreparedOpeningCanvas(
  current: IleWorkCanvasScene | null | undefined,
  prepared: IleWorkCanvasScene | null | undefined,
): { scene: IleWorkCanvasScene; seeded: boolean } {
  const live = serializeIleWorkCanvasScene(current);
  if (ileWorkCanvasHasLiveElements(live)) return { scene: live, seeded: false };
  const next = parseFlowOpeningCanvasScene(prepared);
  if (!next) return { scene: live, seeded: false };
  return { scene: learnerOpeningCanvasScene(next), seeded: true };
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
