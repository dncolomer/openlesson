/**
 * Enforced-channel session purity: if Muse, video, or screenshots are required
 * and no data is flowing, the same 5s / 3-strike protocol as think-aloud silence
 * invalidates the session. Audio stays on the speech bar.
 */

import type { FlowEnforcedChannels } from "@/lib/flow-channels";
import { TAP_SILENCE_AUTO_STASH_MS } from "@/lib/tap-session-purity";

export type FlowSensorChannelId = "muse" | "video" | "screenshots";

export type FlowChannelLive = {
  muse: boolean;
  video: boolean;
  screenshots: boolean;
};

export const FLOW_SENSOR_CHANNEL_IDS: readonly FlowSensorChannelId[] = [
  "muse",
  "video",
  "screenshots",
];

export function mediaStreamLive(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  return stream.getTracks().some((track) => track.readyState === "live");
}

export function museSamplesLive(input: {
  lastSampleAtMs: number | null | undefined;
  nowMs?: number;
  maxAgeMs?: number;
}): boolean {
  const last = input.lastSampleAtMs;
  if (last == null || !Number.isFinite(last)) return false;
  return (input.nowMs ?? Date.now()) - last < (input.maxAgeMs ?? TAP_SILENCE_AUTO_STASH_MS);
}

export function emptyFlowChannelLive(): FlowChannelLive {
  return { muse: false, video: false, screenshots: false };
}

export function anySensorChannelEnforced(channels: FlowEnforcedChannels): boolean {
  return FLOW_SENSOR_CHANNEL_IDS.some((id) => channels[id]);
}

export function sessionPurityArmed(channels: FlowEnforcedChannels): boolean {
  return channels.audio || anySensorChannelEnforced(channels);
}

export function flowEnforcedChannelsKey(channels: FlowEnforcedChannels): string {
  return `${channels.audio ? "a" : ""}${channels.muse ? "m" : ""}${channels.video ? "v" : ""}${channels.screenshots ? "s" : ""}`;
}

export function enforcedSensorChannelsMissing(
  channels: FlowEnforcedChannels,
  live: FlowChannelLive,
): FlowSensorChannelId[] {
  return FLOW_SENSOR_CHANNEL_IDS.filter((id) => channels[id] && !live[id]);
}

export function shouldPenalizeEnforcedChannelIdle(
  idleMs: number,
  missingCount: number,
  thresholdMs: number = TAP_SILENCE_AUTO_STASH_MS,
): boolean {
  return missingCount > 0 && idleMs >= thresholdMs;
}
