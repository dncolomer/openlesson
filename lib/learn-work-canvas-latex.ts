/**
 * Work-canvas LaTeX: Excalidraw text is plain glyphs, so `$...$` / `$$...$$`
 * is parsed here and rendered with KaTeX in an overlay.
 */
import katex from "katex";
import type { IleWorkCanvasElement } from "@/lib/learn-work-canvas-scene";

export const ILE_WORK_CANVAS_LATEX_OVERLAY = "ile-work-canvas-latex";

export type IleWorkCanvasLatexPart =
  | { kind: "text"; value: string }
  | { kind: "math"; value: string; display: boolean };

export type IleWorkCanvasLatexTarget = {
  id: string;
  html: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
};

const htmlCache = new Map<string, string>();

/** Undo doubled backslashes models often emit (`\\\\frac` → `\\frac`). */
export function ileWorkCanvasUnescapeLatex(source: string): string {
  return String(source || "")
    .replace(/\\\\([a-zA-Z]+)/g, "\\$1")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]")
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)");
}

function looksLikeLatex(inner: string): boolean {
  const text = inner.trim();
  if (!text) return false;
  if (/^\$/.test(text)) return false;
  if (/^\d[\d.,]*$/.test(text)) return false;
  if (/[\\^_{}=]/.test(text)) return true;
  if (/^[A-Za-z][A-Za-z0-9]*$/.test(text)) return true;
  if (/\s/.test(text)) return false;
  return /[A-Za-z]/.test(text);
}

function pushText(parts: IleWorkCanvasLatexPart[], value: string) {
  if (!value) return;
  const last = parts[parts.length - 1];
  if (last?.kind === "text") {
    last.value += value;
    return;
  }
  parts.push({ kind: "text", value });
}

/** Split a board string into prose and math spans. */
export function ileWorkCanvasLatexParts(source: string): IleWorkCanvasLatexPart[] {
  const text = ileWorkCanvasUnescapeLatex(source);
  const parts: IleWorkCanvasLatexPart[] = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("$$", i)) {
      const end = text.indexOf("$$", i + 2);
      if (end >= 0) {
        const inner = text.slice(i + 2, end);
        if (looksLikeLatex(inner)) {
          parts.push({ kind: "math", value: inner.trim(), display: true });
          i = end + 2;
          continue;
        }
      }
    }
    if (text.startsWith("\\[", i)) {
      const end = text.indexOf("\\]", i + 2);
      if (end >= 0) {
        const inner = text.slice(i + 2, end);
        if (looksLikeLatex(inner)) {
          parts.push({ kind: "math", value: inner.trim(), display: true });
          i = end + 2;
          continue;
        }
      }
    }
    if (text.startsWith("\\(", i)) {
      const end = text.indexOf("\\)", i + 2);
      if (end >= 0) {
        const inner = text.slice(i + 2, end);
        if (looksLikeLatex(inner)) {
          parts.push({ kind: "math", value: inner.trim(), display: false });
          i = end + 2;
          continue;
        }
      }
    }
    if (text[i] === "$" && text[i + 1] !== "$") {
      const end = text.indexOf("$", i + 1);
      if (end > i + 1) {
        const inner = text.slice(i + 1, end);
        if (looksLikeLatex(inner)) {
          parts.push({ kind: "math", value: inner.trim(), display: false });
          i = end + 1;
          continue;
        }
      }
    }
    pushText(parts, text[i] ?? "");
    i += 1;
  }
  return parts;
}

export function ileWorkCanvasTextHasLatex(source: string): boolean {
  return ileWorkCanvasLatexParts(source).some((part) => part.kind === "math");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMath(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, {
      throwOnError: false,
      displayMode: display,
      output: "html",
      strict: "ignore",
    });
  } catch {
    return escapeHtml(display ? `$$${tex}$$` : `$${tex}$`);
  }
}

/** KaTeX HTML for a board string. Empty when there is no math. */
export function ileWorkCanvasLatexHtml(source: string): string {
  const key = String(source || "");
  const cached = htmlCache.get(key);
  if (cached != null) return cached;
  const parts = ileWorkCanvasLatexParts(key);
  if (!parts.some((part) => part.kind === "math")) {
    htmlCache.set(key, "");
    return "";
  }
  const html = parts
    .map((part) => {
      if (part.kind === "text") {
        return escapeHtml(part.value).replace(/\r\n|\n|\r/g, "<br/>");
      }
      return renderMath(part.value, part.display);
    })
    .join("");
  if (htmlCache.size > 240) htmlCache.clear();
  htmlCache.set(key, html);
  return html;
}

function editingTextId(appState: { editingTextElement?: unknown; editingElement?: unknown } | null | undefined): string | null {
  const raw = appState?.editingTextElement ?? appState?.editingElement;
  if (!raw) return null;
  if (typeof raw === "string") return raw.trim() || null;
  if (typeof raw === "object" && "id" in raw) {
    const id = String((raw as { id?: unknown }).id || "").trim();
    return id || null;
  }
  return null;
}

export function ileWorkCanvasLatexTargets(
  elements: readonly IleWorkCanvasElement[] | null | undefined,
  appState?: { editingTextElement?: unknown; editingElement?: unknown } | null,
): IleWorkCanvasLatexTarget[] {
  const editing = editingTextId(appState);
  const out: IleWorkCanvasLatexTarget[] = [];
  for (const el of elements ?? []) {
    if (!el || el.isDeleted || el.type !== "text" || el.id === editing) continue;
    const source = String(el.originalText || el.text || "");
    const html = ileWorkCanvasLatexHtml(source);
    if (!html) continue;
    out.push({
      id: el.id,
      html,
      x: Number(el.x) || 0,
      y: Number(el.y) || 0,
      width: Math.max(8, Number(el.width) || 0),
      height: Math.max(8, Number(el.height) || 0),
      fontSize: Math.max(12, Number(el.fontSize) || 20),
    });
  }
  return out;
}

export function ileWorkCanvasLatexSignature(targets: readonly IleWorkCanvasLatexTarget[]): string {
  return targets.map((item) => `${item.id}:${item.html.length}:${item.width}:${item.fontSize}`).join("|");
}
