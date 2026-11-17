/**
 * Author-chosen channels a product-flow run requires.
 * Existing rows with a null column keep Audio on (think-aloud).
 */

export const FLOW_CHANNEL_IDS = ["audio", "muse", "video", "screenshots"] as const;

export type FlowChannelId = (typeof FLOW_CHANNEL_IDS)[number];

export type FlowEnforcedChannels = {
  audio: boolean;
  muse: boolean;
  video: boolean;
  screenshots: boolean;
};

/** Legacy flows and map Learn sessions: think-aloud is required. */
export const DEFAULT_FLOW_ENFORCED_CHANNELS: FlowEnforcedChannels = {
  audio: true,
  muse: false,
  video: false,
  screenshots: false,
};

/** Calibration sounding does not require sensors or think-aloud. */
export const OPTIONAL_FLOW_ENFORCED_CHANNELS: FlowEnforcedChannels = {
  audio: false,
  muse: false,
  video: false,
  screenshots: false,
};

export const FLOW_CHANNEL_LABELS: Record<FlowChannelId, string> = {
  audio: "Audio",
  muse: "Muse (EEG)",
  video: "Video",
  screenshots: "Screenshots",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseFlag(value: unknown, fallback: boolean): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (text === "true" || text === "1" || text === "yes") return true;
    if (text === "false" || text === "0" || text === "no") return false;
  }
  return fallback;
}

export function parseFlowEnforcedChannels(raw: unknown): FlowEnforcedChannels {
  const record = asRecord(raw);
  if (!record) return { ...DEFAULT_FLOW_ENFORCED_CHANNELS };
  return {
    audio: parseFlag(record.audio, DEFAULT_FLOW_ENFORCED_CHANNELS.audio),
    muse: parseFlag(record.muse, DEFAULT_FLOW_ENFORCED_CHANNELS.muse),
    video: parseFlag(record.video, DEFAULT_FLOW_ENFORCED_CHANNELS.video),
    screenshots: parseFlag(record.screenshots, DEFAULT_FLOW_ENFORCED_CHANNELS.screenshots),
  };
}

export function serializeFlowEnforcedChannels(
  value: FlowEnforcedChannels | null | undefined,
): FlowEnforcedChannels {
  return parseFlowEnforcedChannels(value);
}

export function nextFlowEnforcedChannels(
  current: unknown,
  incoming: unknown,
): FlowEnforcedChannels {
  if (incoming === undefined) return parseFlowEnforcedChannels(current);
  return parseFlowEnforcedChannels(incoming);
}

export function flowChannelEnforced(
  channels: FlowEnforcedChannels | null | undefined,
  id: FlowChannelId,
): boolean {
  return parseFlowEnforcedChannels(channels)[id];
}

/** Session claim stamp. Missing metadata keeps the Audio-on default. */
export function sessionEnforcedChannels(metadata: unknown): FlowEnforcedChannels {
  const record = asRecord(metadata);
  if (!record) return { ...DEFAULT_FLOW_ENFORCED_CHANNELS };
  const raw = record.enforcedChannels ?? record.enforced_channels;
  if (raw == null) return { ...DEFAULT_FLOW_ENFORCED_CHANNELS };
  return parseFlowEnforcedChannels(raw);
}

export function withEnforcedChannelsMetadata(
  metadata: Record<string, unknown>,
  channels: FlowEnforcedChannels,
): Record<string, unknown> {
  return {
    ...metadata,
    enforcedChannels: serializeFlowEnforcedChannels(channels),
  };
}
