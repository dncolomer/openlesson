import {
  DEFAULT_SESSION_CANVAS_STYLE,
  DEFAULT_SESSION_SIDEBAR_STYLE_TOKENS,
  parseSessionSidebarStyle,
  sessionCanvasHex6,
  type SessionCanvasStyle,
  type SessionSidebarStyle,
  type SessionSidebarStyleTokens,
} from "@/lib/session-sidebar-style";

export const PROTOCOL_STYLE_PRESET_IDS = ["dark", "light", "high_contrast"] as const;

export type ProtocolStylePresetId = (typeof PROTOCOL_STYLE_PRESET_IDS)[number];

type ProtocolStylePresetChrome = {
  tokens: SessionSidebarStyleTokens;
  canvas: Pick<SessionCanvasStyle, "background" | "stroke">;
};

export const PROTOCOL_STYLE_PRESETS: Record<ProtocolStylePresetId, ProtocolStylePresetChrome> = {
  dark: {
    tokens: { ...DEFAULT_SESSION_SIDEBAR_STYLE_TOKENS },
    canvas: {
      background: DEFAULT_SESSION_CANVAS_STYLE.background,
      stroke: DEFAULT_SESSION_CANVAS_STYLE.stroke,
    },
  },
  light: {
    tokens: {
      background: "#f4f1ea",
      border: "rgba(20,20,20,0.22)",
      text: "#141414",
      muted: "rgba(20,20,20,0.48)",
      panel: "#ffffff",
      accent: "#141414",
      overlay: "rgba(244,241,234,0.55)",
    },
    canvas: {
      background: "#ece8df",
      stroke: "#1a1a1a",
    },
  },
  high_contrast: {
    tokens: {
      background: "#000000",
      border: "#ffffff",
      text: "#ffffff",
      muted: "#ffffff",
      panel: "#000000",
      accent: "#ffffff",
      overlay: "rgba(0,0,0,0.72)",
    },
    canvas: {
      background: "#000000",
      stroke: "#ffffff",
    },
  },
};

export function parseProtocolStylePresetId(raw: unknown): ProtocolStylePresetId | null {
  const id = String(raw || "").trim();
  return PROTOCOL_STYLE_PRESET_IDS.includes(id as ProtocolStylePresetId)
    ? (id as ProtocolStylePresetId)
    : null;
}

/** Swap rail + board colors. Prompt, still, zen, and grid stay as they are. */
export function applyProtocolStylePreset(
  style: SessionSidebarStyle | null | undefined,
  id: ProtocolStylePresetId,
): SessionSidebarStyle {
  const current = parseSessionSidebarStyle(style);
  const preset = PROTOCOL_STYLE_PRESETS[id];
  return {
    ...current,
    tokens: { ...preset.tokens },
    canvas: {
      ...current.canvas,
      background: preset.canvas.background,
      stroke: preset.canvas.stroke,
    },
  };
}

function tokensMatch(a: SessionSidebarStyleTokens, b: SessionSidebarStyleTokens): boolean {
  return (Object.keys(a) as (keyof SessionSidebarStyleTokens)[]).every((key) => a[key] === b[key]);
}

export function matchingProtocolStylePreset(
  style: SessionSidebarStyle | null | undefined,
): ProtocolStylePresetId | null {
  const current = parseSessionSidebarStyle(style);
  for (const id of PROTOCOL_STYLE_PRESET_IDS) {
    const preset = PROTOCOL_STYLE_PRESETS[id];
    if (
      tokensMatch(current.tokens, preset.tokens) &&
      sessionCanvasHex6(current.canvas.background) === sessionCanvasHex6(preset.canvas.background) &&
      sessionCanvasHex6(current.canvas.stroke) === sessionCanvasHex6(preset.canvas.stroke)
    ) {
      return id;
    }
  }
  return null;
}
