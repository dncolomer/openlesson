/**
 * OpenAI-compatible Chat Completions port.
 * Cloud default is xAI (`AI_BASE_URL` unset → https://api.x.ai/v1, `AI_API_KEY` unset → `XAI_API_KEY`).
 */
import {
  CANVAS_ASK_MODEL,
  CANVAS_COMMAND_MODEL,
  DEFAULT_MODEL,
} from "@/lib/xai-models";

export type ChatConfig = {
  baseURL: string;
  apiKey: string | null;
  model: string;
  canvasAskModel: string;
  canvasCommandModel: string;
};

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getChatConfig(): ChatConfig {
  const baseURL = trimSlash(
    process.env.AI_BASE_URL?.trim() || "https://api.x.ai/v1",
  );
  const apiKey =
    process.env.AI_API_KEY?.trim() || process.env.XAI_API_KEY?.trim() || null;
  return {
    baseURL,
    apiKey,
    model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL,
    canvasAskModel: process.env.AI_CANVAS_ASK_MODEL?.trim() || CANVAS_ASK_MODEL,
    canvasCommandModel:
      process.env.AI_CANVAS_COMMAND_MODEL?.trim() || CANVAS_COMMAND_MODEL,
  };
}

export function chatCompletionsUrl(): string {
  return `${getChatConfig().baseURL}/chat/completions`;
}

export function resolveChatApiKey(override?: string | null): string | null {
  if (override) return override;
  return getChatConfig().apiKey;
}

export type ChatPort = {
  complete: (messages: unknown, config: unknown) => Promise<unknown>;
  completeJson: (messages: unknown, config: unknown) => Promise<unknown>;
};

let chatOverride: ChatPort | null = null;

export function setChatForTests(port: ChatPort | null): void {
  chatOverride = port;
}

export function getChat(): ChatPort {
  if (chatOverride) return chatOverride;
  // Lazy require: xai-client reads getChatConfig from this module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const client = require("@/lib/xai-client") as {
    callXai: ChatPort["complete"];
    callXaiJSON: ChatPort["completeJson"];
  };
  return {
    complete: (messages, config) => client.callXai(messages, config),
    completeJson: (messages, config) => client.callXaiJSON(messages, config),
  };
}
