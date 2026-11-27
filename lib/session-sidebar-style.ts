/**
 * Prompt-built look for the 16rem session canvas sidebar.
 * Tokens restyle MAGI chrome. backgroundImage paints the topic card.
 */

export const SESSION_SIDEBAR_STYLE_PROMPT_MAX = 2000;
export const SESSION_SIDEBAR_STYLE_ASSET_LIMIT = 5;

export type SessionSidebarStyleTokens = {
  background: string;
  border: string;
  text: string;
  muted: string;
  panel: string;
  accent: string;
  overlay: string;
};

/** Visual colors the learner sees on the dark Excalidraw board. */
export type SessionCanvasStyle = {
  background: string;
  stroke: string;
  zenMode: boolean;
};

export type SessionSidebarStyle = {
  prompt: string;
  generatedAt: string | null;
  backgroundImage: string | null;
  tokens: SessionSidebarStyleTokens;
  canvas: SessionCanvasStyle;
};

export const DEFAULT_SESSION_SIDEBAR_STYLE_TOKENS: SessionSidebarStyleTokens = {
  background: "#000000",
  border: "rgba(255,255,255,0.3)",
  text: "#ffffff",
  muted: "rgba(255,255,255,0.4)",
  panel: "#000000",
  accent: "#ffffff",
  overlay: "rgba(0,0,0,0.55)",
};

/**
 * Visual MAGI board: near-black fill, near-white ink (stored Excalidraw stroke
 * `#1e1e1e` inverts to `#e1e1e1`), zen on.
 */
export const DEFAULT_SESSION_CANVAS_STYLE: SessionCanvasStyle = {
  background: "#0a0a0a",
  stroke: "#e1e1e1",
  zenMode: true,
};

export const EMPTY_SESSION_SIDEBAR_STYLE: SessionSidebarStyle = {
  prompt: "",
  generatedAt: null,
  backgroundImage: null,
  tokens: { ...DEFAULT_SESSION_SIDEBAR_STYLE_TOKENS },
  canvas: { ...DEFAULT_SESSION_CANVAS_STYLE },
};

const COLOR_RE =
  /^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/;

export function isSessionSidebarColor(value: unknown): value is string {
  const text = String(value || "").trim();
  return COLOR_RE.test(text);
}

export function sessionCanvasHex6(value: unknown, fallback = DEFAULT_SESSION_CANVAS_STYLE.background): string {
  const text = String(value || "").trim();
  const hex = text.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3) {
      digits = digits
        .split("")
        .map((ch) => `${ch}${ch}`)
        .join("");
    }
    return `#${digits.slice(0, 6).toLowerCase()}`;
  }
  const rgb = text.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgb) {
    const toHex = (n: string) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0");
    return `#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`;
  }
  if (fallback !== text && fallback) return sessionCanvasHex6(fallback, "");
  return DEFAULT_SESSION_CANVAS_STYLE.background;
}

/** Invert RGB so a visual color can be stored for Excalidraw's dark-theme filter. */
export function invertSessionCanvasColor(value: unknown): string {
  const hex = sessionCanvasHex6(value);
  const n = Number.parseInt(hex.slice(1), 16);
  const r = 255 - ((n >> 16) & 255);
  const g = 255 - ((n >> 8) & 255);
  const b = 255 - (n & 255);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function parseSessionCanvasStyle(value: unknown): SessionCanvasStyle {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const backgroundSrc = row.canvasBackground ?? row.background;
  const strokeSrc = row.canvasStroke ?? row.stroke;
  const background = isSessionSidebarColor(backgroundSrc)
    ? String(backgroundSrc).trim()
    : DEFAULT_SESSION_CANVAS_STYLE.background;
  const stroke = isSessionSidebarColor(strokeSrc)
    ? String(strokeSrc).trim()
    : DEFAULT_SESSION_CANVAS_STYLE.stroke;
  const zenRaw = row.zenMode ?? row.zenModeEnabled ?? row.zen;
  const zenMode = typeof zenRaw === "boolean" ? zenRaw : DEFAULT_SESSION_CANVAS_STYLE.zenMode;
  return { background, stroke, zenMode };
}

/** Stored Excalidraw appState for the org board look (pre-invert). */
export function sessionCanvasExcalidrawChrome(canvas: SessionCanvasStyle | null | undefined): {
  viewBackgroundColor: string;
  currentItemStrokeColor: string;
  zenModeEnabled: boolean;
} {
  const resolved = parseSessionCanvasStyle(canvas);
  return {
    viewBackgroundColor: invertSessionCanvasColor(resolved.background),
    currentItemStrokeColor: invertSessionCanvasColor(resolved.stroke),
    zenModeEnabled: resolved.zenMode,
  };
}

export function parseSessionSidebarStyle(value: unknown): SessionSidebarStyle {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const tokensIn =
    row.tokens && typeof row.tokens === "object"
      ? (row.tokens as Record<string, unknown>)
      : row;
  const tokens: SessionSidebarStyleTokens = { ...DEFAULT_SESSION_SIDEBAR_STYLE_TOKENS };
  for (const key of Object.keys(tokens) as (keyof SessionSidebarStyleTokens)[]) {
    const next = tokensIn[key];
    if (isSessionSidebarColor(next)) tokens[key] = String(next).trim();
  }
  const prompt = String(row.prompt || "").trim().slice(0, SESSION_SIDEBAR_STYLE_PROMPT_MAX);
  const generatedAt = String(row.generatedAt || row.generated_at || "").trim() || null;
  const backgroundImage = String(row.backgroundImage || row.background_image || "").trim() || null;
  const canvas = parseSessionCanvasStyle(
    row.canvas && typeof row.canvas === "object"
      ? row.canvas
      : {
          canvasBackground: row.canvasBackground,
          canvasStroke: row.canvasStroke,
          zenMode: row.zenMode ?? row.zenModeEnabled,
        },
  );
  return { prompt, generatedAt, backgroundImage, tokens, canvas };
}

export function sessionSidebarStyleCssVars(
  style: SessionSidebarStyle | null | undefined,
): Record<string, string> {
  const resolved = parseSessionSidebarStyle(style);
  const vars: Record<string, string> = {
    "--session-sidebar-bg": resolved.tokens.background,
    "--session-sidebar-border": resolved.tokens.border,
    "--session-sidebar-text": resolved.tokens.text,
    "--session-sidebar-muted": resolved.tokens.muted,
    "--session-sidebar-panel": resolved.tokens.panel,
    "--session-sidebar-accent": resolved.tokens.accent,
    "--session-sidebar-overlay": resolved.tokens.overlay,
  };
  if (resolved.backgroundImage) {
    vars["--session-sidebar-wash"] = `url(${resolved.backgroundImage})`;
  }
  return vars;
}

export function clampSidebarStylePrompt(value: unknown): string {
  return String(value || "").trim().slice(0, SESSION_SIDEBAR_STYLE_PROMPT_MAX);
}

/** Topic-card still in the org styler: generated image, else the latest uploaded asset. */
export function sessionSidebarPreviewStill(
  style: SessionSidebarStyle | null | undefined,
  assetUrls: readonly string[] | null | undefined,
): string | null {
  const resolved = parseSessionSidebarStyle(style);
  if (resolved.backgroundImage) return resolved.backgroundImage;
  const urls = (assetUrls ?? [])
    .map((url) => String(url || "").trim())
    .filter(Boolean);
  return urls.length > 0 ? urls[urls.length - 1] : null;
}

export function sidebarStyleImagePrompt(input: {
  prompt: string;
  assetCount: number;
}): string {
  const look = clampSidebarStylePrompt(input.prompt) || "dark MAGI console, ink navy, sharp corners";
  const refs =
    input.assetCount > 0
      ? ` Honor the ${Math.min(input.assetCount, SESSION_SIDEBAR_STYLE_ASSET_LIMIT)} uploaded reference stills for palette, texture, and mood.`
      : "";
  return `Vertical 9:16 still for a 16rem product sidebar beside a dark work canvas. Atmospheric, photographic, no type, no UI chrome, no logos, no watermarks. Mood: ${look}.${refs}`;
}

export function isMissingSidebarStyleColumn(error: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null): boolean {
  if (!error) return false;
  const msg = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  if (!msg.includes("sidebar_style")) return false;
  return (
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find") ||
    msg.includes("column")
  );
}
