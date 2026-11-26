/**
 * Compact mermaid view of a Work canvas. Positions are omitted; arrows use
 * Excalidraw start/end bindings when present.
 */
import {
  BOARD_INSTRUCTION_NOTE_KEY,
  serializeIleWorkCanvasScene,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
} from "@/lib/learn-work-canvas-scene";
import { ileWorkCanvasCompactListing } from "@/lib/learn-work-canvas-xai";

function skipChrome(el: IleWorkCanvasElement): boolean {
  const part = el.customData?.[BOARD_INSTRUCTION_NOTE_KEY];
  return part === "header" || part === "label" || part === "body";
}

function liveElements(scene: IleWorkCanvasScene): IleWorkCanvasElement[] {
  return serializeIleWorkCanvasScene(scene).elements.filter(
    (el) => !el.isDeleted && el.type !== "cursor" && !skipChrome(el),
  );
}

function textOf(el: IleWorkCanvasElement): string {
  return String(el.originalText || el.text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function mermaidId(id: string): string {
  const cleaned = String(id || "")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .slice(0, 48);
  if (!cleaned) return "n_mark";
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `n_${cleaned}`;
}

function mermaidLabel(text: string): string {
  const cleaned = text
    .replace(/[\\"[\]{}()|#]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96);
  return cleaned || "mark";
}

function bindingElementId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = (raw as { elementId?: unknown }).elementId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function nodeShape(type: string, label: string): string {
  if (type === "diamond") return `{"${label}"}`;
  if (type === "ellipse") return `(("${label}"))`;
  if (type === "frame") return `[["${label}"]]`;
  return `["${label}"]`;
}

function boundTextByContainer(live: readonly IleWorkCanvasElement[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const el of live) {
    const containerId = typeof el.containerId === "string" ? el.containerId : "";
    const text = textOf(el);
    if (!containerId || !text) continue;
    map.set(containerId, text);
  }
  return map;
}

export function ileWorkCanvasMermaid(
  scene: IleWorkCanvasScene | { elements?: unknown } | null | undefined,
): string {
  const live = liveElements(serializeIleWorkCanvasScene(scene));
  if (!live.length) return "flowchart TB\n  empty[\"empty board\"]";
  const boundText = boundTextByContainer(live);
  const ids = new Set(live.map((el) => el.id));
  const lines: string[] = ["flowchart TB"];
  const nodeIds = new Set<string>();

  for (const el of live) {
    if (el.type === "arrow" || el.type === "line" || el.type === "freedraw") continue;
    const label = mermaidLabel(boundText.get(el.id) || textOf(el) || el.type);
    const id = mermaidId(el.id);
    nodeIds.add(el.id);
    lines.push(`  ${id}${nodeShape(el.type, label)}`);
  }

  for (const el of live) {
    if (el.type !== "arrow") continue;
    const from = bindingElementId(el.startBinding);
    const to = bindingElementId(el.endBinding);
    if (!from || !to || !ids.has(from) || !ids.has(to)) continue;
    if (!nodeIds.has(from) || !nodeIds.has(to)) continue;
    lines.push(`  ${mermaidId(from)} --> ${mermaidId(to)}`);
  }

  if (lines.length === 1) {
    lines.push(`  board["${mermaidLabel(ileWorkCanvasCompactListing(scene).slice(0, 80))}"]`);
  }
  return lines.join("\n");
}

export function ileWorkCanvasMermaidDocument(
  scene: IleWorkCanvasScene | { elements?: unknown } | null | undefined,
  meta?: { actionCount?: number; everyActions?: number },
): string {
  const actionCount = Math.max(0, Math.floor(Number(meta?.actionCount) || 0));
  const everyActions = Math.max(0, Math.floor(Number(meta?.everyActions) || 0));
  const cadence =
    everyActions > 0
      ? `Captured after ${actionCount} canvas action${actionCount === 1 ? "" : "s"} (every ${everyActions}).`
      : `Captured after ${actionCount} canvas action${actionCount === 1 ? "" : "s"}.`;
  return [
    "# Work canvas",
    "",
    cadence,
    "",
    "```mermaid",
    ileWorkCanvasMermaid(scene),
    "```",
    "",
    "## Marks",
    ileWorkCanvasCompactListing(scene),
    "",
  ].join("\n");
}
