/**
 * Turn a prompt plus uploaded assets into session-sidebar tokens and a still.
 */

import {
  callXaiWithSchema,
  systemMessage,
  type JsonSchema,
  type Message,
  type MessageContent,
} from "@/lib/xai-client";
import { editXaiImage, generateXaiImage } from "@/lib/xai-image";
import {
  clampSidebarStylePrompt,
  DEFAULT_SESSION_CANVAS_STYLE,
  DEFAULT_SESSION_SIDEBAR_STYLE_TOKENS,
  parseSessionSidebarStyle,
  SESSION_SIDEBAR_STYLE_ASSET_LIMIT,
  sidebarStyleImagePrompt,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

const TOKEN_SCHEMA: JsonSchema = {
  name: "session_sidebar_style",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "background",
      "border",
      "text",
      "muted",
      "panel",
      "accent",
      "overlay",
      "canvasBackground",
      "canvasStroke",
      "zenMode",
    ],
    properties: {
      background: { type: "string" },
      border: { type: "string" },
      text: { type: "string" },
      muted: { type: "string" },
      panel: { type: "string" },
      accent: { type: "string" },
      overlay: { type: "string" },
      canvasBackground: { type: "string" },
      canvasStroke: { type: "string" },
      zenMode: { type: "boolean" },
    },
  },
};

const SYSTEM = `You style a 16rem-wide left session sidebar and the Excalidraw work board beside it.
Return CSS colors only (hex or rgb/rgba) plus zenMode. Keep MAGI: sharp corners, high contrast, readable type.
background and panel fill every chrome surface on that rail: topic card, Commands/Help tabs, command tiles, and the Data console (Audio / EEG / Video / Screen tabs, standby screen, Enable).
Do not leave Data as pure black unless the prompt asks for black.
border is hairline. text is labels. muted is secondary and unselected tabs.
accent is selected tabs and the Exit/End bar. overlay tints the topic-card photograph.
canvasBackground is the board fill the learner sees. canvasStroke is the default ink/pen color they see.
zenMode true hides Excalidraw chrome when a board opens; false shows the toolbar.
Do not name the product. Do not return images.`;

export function sidebarStyleUserContent(input: {
  prompt: string;
  assetUrls: readonly string[];
}): MessageContent[] {
  const look = clampSidebarStylePrompt(input.prompt);
  const urls = input.assetUrls.map((url) => String(url || "").trim()).filter(Boolean).slice(0, SESSION_SIDEBAR_STYLE_ASSET_LIMIT);
  const text = [
    `Style prompt: ${look || "Keep the current black MAGI rail, white type, hairline borders."}`,
    "Paint the Data panel with the same background/panel/border/text tokens as Commands and Help.",
    "Also set the Excalidraw board: canvasBackground, canvasStroke (visual ink), and zenMode.",
    urls.length ? `Use these ${urls.length} uploaded assets as palette and texture references.` : "No uploaded assets.",
  ].join("\n");
  const parts: MessageContent[] = [{ type: "text", text }];
  for (const url of urls) {
    parts.push({ type: "image_url", image_url: { url } });
  }
  return parts;
}

export async function generateSessionSidebarTokens(input: {
  prompt: string;
  assetUrls: readonly string[];
  canvas?: SessionSidebarStyle["canvas"] | null;
}): Promise<Pick<SessionSidebarStyle, "tokens" | "canvas">> {
  const messages: Message[] = [
    systemMessage(SYSTEM),
    { role: "user", content: sidebarStyleUserContent(input) },
  ];
  const response = await callXaiWithSchema<Record<string, unknown>>(messages, TOKEN_SCHEMA, {
    maxTokens: 400,
    temperature: 0.2,
    reasoningEffort: "low",
    fetchTimeout: 30_000,
    retries: 1,
  });
  const keepGrid = parseSessionSidebarStyle({ canvas: input.canvas }).canvas.gridMode;
  if (!response.success || !response.data || typeof response.data !== "object") {
    return {
      tokens: { ...DEFAULT_SESSION_SIDEBAR_STYLE_TOKENS },
      canvas: { ...DEFAULT_SESSION_CANVAS_STYLE, gridMode: keepGrid },
    };
  }
  const parsed = parseSessionSidebarStyle({
    tokens: response.data,
    canvasBackground: response.data.canvasBackground,
    canvasStroke: response.data.canvasStroke,
    zenMode: response.data.zenMode,
    gridMode: keepGrid,
  });
  return { tokens: parsed.tokens, canvas: { ...parsed.canvas, gridMode: keepGrid } };
}

export async function generateSessionSidebarStill(input: {
  prompt: string;
  assetUrls: readonly string[];
}): Promise<{ bytes: Buffer; contentType: "image/png" | "image/jpeg" | "image/webp" } | null> {
  const imagePrompt = sidebarStyleImagePrompt({
    prompt: input.prompt,
    assetCount: input.assetUrls.length,
  });
  const urls = input.assetUrls.map((url) => String(url || "").trim()).filter(Boolean).slice(0, SESSION_SIDEBAR_STYLE_ASSET_LIMIT);
  const result = urls.length
    ? await editXaiImage({ prompt: imagePrompt, imageUrls: urls })
    : await generateXaiImage(imagePrompt);
  if (!result.ok) {
    console.error("[sidebar-style] still failed:", result.error);
    return null;
  }
  return { bytes: result.bytes, contentType: result.contentType };
}

export async function generateSessionSidebarStyle(input: {
  prompt: string;
  assetUrls: readonly string[];
  canvas?: SessionSidebarStyle["canvas"] | null;
  now?: Date;
}): Promise<{ style: SessionSidebarStyle; still: { bytes: Buffer; contentType: "image/png" | "image/jpeg" | "image/webp" } | null }> {
  const prompt = clampSidebarStylePrompt(input.prompt);
  const [look, still] = await Promise.all([
    generateSessionSidebarTokens({ prompt, assetUrls: input.assetUrls, canvas: input.canvas }),
    generateSessionSidebarStill({ prompt, assetUrls: input.assetUrls }),
  ]);
  return {
    style: {
      prompt,
      generatedAt: (input.now ?? new Date()).toISOString(),
      backgroundImage: null,
      tokens: look.tokens,
      canvas: look.canvas,
    },
    still,
  };
}
