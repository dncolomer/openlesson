// ============================================
// Muse EEG contact quality — pure functions over sample windows.
// No Bluetooth. Shared by Athena client, session stream, labs, and EEG PoW.
// ============================================

export const EEG_QUALITY_CHANNELS = [
  "TP9",
  "AF7",
  "AF8",
  "TP10",
  "FPz",
  "AUX_R",
  "AUX_L",
] as const;

export type EegQualityChannel = (typeof EEG_QUALITY_CHANNELS)[number];
export type SignalQualityStatus = "good" | "fair" | "poor";

/** Minimum samples before a channel is treated as having data (not empty). */
export const MIN_EEG_QUALITY_SAMPLES = 64;

/** ADC rails after Muse µV scaling — floating / no-contact electrodes clip here. */
export const EEG_RAIL_LOW_UV = -248;
export const EEG_RAIL_HIGH_UV = 240;

/** Strongly negative DC offset is typical of a floating electrode. */
export const EEG_FLOATING_DC_OFFSET_UV = -75;

/**
 * Empirically: on-head Muse variance ~15k–30k; in-air ambient ~8k–15k.
 * Good contact is clearly above ambient; fair is the on-head lower bound.
 */
export const EEG_ON_HEAD_VARIANCE_GOOD = 18_000;
export const EEG_ON_HEAD_VARIANCE_FAIR = 10_000;

/** Calibration / overall: at least this many good channels → overall `good`. */
export const EEG_CONTACT_GOOD_CHANNEL_MIN = 3;
/** Pass if at least this many channels are on-head (good or fair), not rail/empty. */
export const EEG_CONTACT_PASS_CHANNEL_MIN = 2;

export interface ChannelQuality {
  channel: string;
  quality: number;
  status: SignalQualityStatus;
  variance: number;
  noiseFloor: number;
  railHits: number;
  dcOffset: number;
}

export interface EegContactScore {
  channels: ChannelQuality[];
  overall: SignalQualityStatus;
  overallQuality: number;
  /** True once at least one channel has enough samples to judge contact. */
  evaluated: boolean;
  /**
   * Enough non-rail, non-empty channels with on-head signal.
   * Streaming / connected alone is not a pass.
   */
  calibrationPassed: boolean;
  electrodeQuality: Record<string, number>;
  channelStatuses: Record<string, SignalQualityStatus>;
  warnings: string[];
}

export interface EegBandPowers {
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  gamma: number;
  [band: string]: number;
}

export function isOnHeadContactStatus(status: SignalQualityStatus): boolean {
  return status === "good" || status === "fair";
}

export function isCountableEegContact(score: EegContactScore): boolean {
  return score.calibrationPassed && isOnHeadContactStatus(score.overall);
}

export function scoreEegChannelSamples(channel: string, samples: number[]): ChannelQuality {
  if (samples.length < MIN_EEG_QUALITY_SAMPLES) {
    return {
      channel,
      quality: 0,
      status: "poor",
      variance: 0,
      noiseFloor: 0,
      railHits: 0,
      dcOffset: 0,
    };
  }

  const variance = computeVariance(samples);
  const noiseFloor = computeNoiseFloor(samples);
  const { railHits, dcOffset } = analyzeClipping(samples);
  const hasClipping = railHits > 3;
  const hasHighOffset = dcOffset < EEG_FLOATING_DC_OFFSET_UV;

  let quality: number;
  let status: SignalQualityStatus;

  if (hasClipping || hasHighOffset) {
    quality = 0.1;
    status = "poor";
  } else if (variance > EEG_ON_HEAD_VARIANCE_GOOD) {
    quality = 0.8;
    status = "good";
  } else if (variance > EEG_ON_HEAD_VARIANCE_FAIR) {
    quality = 0.5;
    status = "fair";
  } else {
    quality = 0.2;
    status = "poor";
  }

  return { channel, quality, status, variance, noiseFloor, railHits, dcOffset };
}

export function scoreEegContactWindow(
  channels: Record<string, number[]> | null | undefined,
): EegContactScore {
  const source = channels ?? {};
  const scored: ChannelQuality[] = [];
  const warnings: string[] = [];
  const electrodeQuality: Record<string, number> = {};
  const channelStatuses: Record<string, SignalQualityStatus> = {};
  let totalQuality = 0;
  let goodChannels = 0;
  let contactChannels = 0;
  let evaluatedChannels = 0;

  for (const ch of EEG_QUALITY_CHANNELS) {
    const samples = source[ch] ?? [];
    const channel = scoreEegChannelSamples(ch, samples);
    scored.push(channel);
    electrodeQuality[ch] = channel.quality;
    channelStatuses[ch] = channel.status;
    totalQuality += channel.quality;

    if (samples.length >= MIN_EEG_QUALITY_SAMPLES) {
      evaluatedChannels++;
    } else {
      warnings.push(`${ch}: No data received`);
    }

    if (channel.status === "poor" && samples.length >= MIN_EEG_QUALITY_SAMPLES) {
      if (channel.railHits > 3 || channel.dcOffset < EEG_FLOATING_DC_OFFSET_UV) {
        warnings.push(
          `${ch}: Poor contact - rail hits: ${channel.railHits}, DC offset: ${channel.dcOffset.toFixed(1)}`,
        );
      }
    }

    if (channel.status === "good") goodChannels++;
    if (isOnHeadContactStatus(channel.status)) contactChannels++;
  }

  const overallQuality = totalQuality / EEG_QUALITY_CHANNELS.length;
  const evaluated = evaluatedChannels > 0;
  const overall: SignalQualityStatus = !evaluated
    ? "poor"
    : goodChannels >= EEG_CONTACT_GOOD_CHANNEL_MIN
      ? "good"
      : contactChannels >= EEG_CONTACT_PASS_CHANNEL_MIN
        ? "fair"
        : "poor";
  const calibrationPassed =
    evaluated && overall !== "poor" && contactChannels >= EEG_CONTACT_PASS_CHANNEL_MIN;

  return {
    channels: scored,
    overall,
    overallQuality,
    evaluated,
    calibrationPassed,
    electrodeQuality,
    channelStatuses,
    warnings,
  };
}

export function analyzeClipping(samples: number[]): { railHits: number; dcOffset: number } {
  const railHits = samples.filter((v) => v <= EEG_RAIL_LOW_UV || v >= EEG_RAIL_HIGH_UV).length;
  const dcOffset = samples.length === 0 ? 0 : samples.reduce((a, b) => a + b, 0) / samples.length;
  return { railHits, dcOffset };
}

export function computeVariance(samples: number[]): number {
  if (samples.length < 2) return 0;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return samples.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / samples.length;
}

export function computeNoiseFloor(samples: number[]): number {
  if (samples.length < 2) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const deviations = samples.map((x) => Math.abs(x - median));
  deviations.sort((a, b) => a - b);
  return deviations[Math.floor(deviations.length / 2)] * 1.4826;
}

export function getQualityColor(quality: number): string {
  if (quality > 0.7) return "#22c55e";
  if (quality > 0.4) return "#eab308";
  return "#ef4444";
}

export function getQualityLabel(quality: number): string {
  if (quality > 0.7) return "Good";
  if (quality > 0.4) return "Fair";
  return "Poor";
}

export function eegChannelsFromMap(
  channelData: Map<string, number[]> | Record<string, number[]>,
): Record<string, number[]> {
  if (channelData instanceof Map) {
    const out: Record<string, number[]> = {};
    for (const [ch, samples] of channelData.entries()) out[ch] = samples;
    return out;
  }
  return channelData;
}

const BAND_RANGES: Record<keyof EegBandPowers, [number, number]> = {
  delta: [1, 4],
  theta: [4, 8],
  alpha: [8, 13],
  beta: [13, 30],
  gamma: [30, 44],
};

/** DFT band powers from forehead (AF7/AF8) windows at 256 Hz. */
export function computeBandPowers(af7: number[], af8: number[]): EegBandPowers {
  const n = 256;
  const sampleRate = 256;

  function channelBands(samples: number[]) {
    const windowed = samples.map(
      (s, i) => s * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))),
    );
    const powers: Record<string, number> = {};
    for (const [band, [fLow, fHigh]] of Object.entries(BAND_RANGES)) {
      let power = 0;
      const binLow = Math.floor((fLow * n) / sampleRate);
      const binHigh = Math.min(Math.ceil((fHigh * n) / sampleRate), n / 2);
      for (let k = binLow; k <= binHigh; k++) {
        let re = 0;
        let im = 0;
        for (let j = 0; j < n; j++) {
          const angle = (2 * Math.PI * k * j) / n;
          re += windowed[j] * Math.cos(angle);
          im -= windowed[j] * Math.sin(angle);
        }
        power += (re * re + im * im) / (n * n);
      }
      powers[band] = power;
    }
    return powers;
  }

  const p1 = channelBands(af7.slice(-n));
  const p2 = channelBands(af8.slice(-n));
  const avg: Record<string, number> = {};
  for (const band of Object.keys(BAND_RANGES)) {
    avg[band] = ((p1[band] || 0) + (p2[band] || 0)) / 2;
  }

  const total = Object.values(avg).reduce((s, v) => s + v, 0);
  if (total > 0) for (const band of Object.keys(avg)) avg[band] /= total;

  return {
    delta: avg.delta || 0,
    theta: avg.theta || 0,
    alpha: avg.alpha || 0,
    beta: avg.beta || 0,
    gamma: avg.gamma || 0,
  };
}

function bandPowersArePresent(powers: Record<string, number> | null | undefined): boolean {
  if (!powers) return false;
  return ["delta", "theta", "alpha", "beta", "gamma"].some(
    (key) => typeof powers[key] === "number" && Number.isFinite(powers[key]),
  );
}

/** Prefer live band powers; otherwise compute from the window (AF7/AF8, then any pair). */
export function resolveEegBandPowers(
  channels: Record<string, number[]>,
  existing?: Record<string, number> | null,
): EegBandPowers | null {
  if (bandPowersArePresent(existing)) {
    return {
      delta: existing!.delta ?? 0,
      theta: existing!.theta ?? 0,
      alpha: existing!.alpha ?? 0,
      beta: existing!.beta ?? 0,
      gamma: existing!.gamma ?? 0,
    };
  }

  const af7 = channels.AF7;
  const af8 = channels.AF8;
  if (af7 && af8 && af7.length >= 256 && af8.length >= 256) {
    return computeBandPowers(af7, af8);
  }

  const ready = Object.values(channels).filter((samples) => samples.length >= 256);
  if (ready.length >= 2) return computeBandPowers(ready[0], ready[1]);
  if (ready.length === 1) return computeBandPowers(ready[0], ready[0]);
  return null;
}

export type MuseEegPreviewState = "off" | "checking" | "poor" | "fair" | "good";

export function museEegPreviewState(
  museStatus: string,
  deviceStatus: {
    signalQuality?: SignalQualityStatus | null;
    calibrationPassed?: boolean | null;
    contactEvaluated?: boolean | null;
  } | null,
): MuseEegPreviewState {
  if (museStatus !== "streaming") return "off";
  if (!deviceStatus?.contactEvaluated) return "checking";
  if (!deviceStatus.calibrationPassed) return "poor";
  const quality = deviceStatus.signalQuality ?? "poor";
  if (quality === "good" || quality === "fair") return quality;
  return "poor";
}

export function museEegPreviewLabel(state: MuseEegPreviewState): string {
  switch (state) {
    case "off":
      return "EEG off";
    case "checking":
      return "EEG checking";
    case "good":
      return "EEG good";
    case "fair":
      return "EEG fair";
    case "poor":
      return "EEG poor";
  }
}
