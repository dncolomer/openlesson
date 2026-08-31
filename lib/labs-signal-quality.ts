// ============================================
// SIGNAL QUALITY SYSTEM - Pre-session calibration & validation
// Scoring lives in muse-eeg-quality (shared with session EEG PoW).
// ============================================

import {
  EEG_QUALITY_CHANNELS,
  computeNoiseFloor,
  computeVariance,
  scoreEegContactWindow,
  type ChannelQuality,
  type EegContactScore,
} from "./muse-eeg-quality";

export type {
  ChannelQuality,
  EegContactScore,
  SignalQualityStatus,
} from "./muse-eeg-quality";

export {
  EEG_QUALITY_CHANNELS,
  getQualityColor,
  getQualityLabel,
  isCountableEegContact,
  scoreEegChannelSamples,
  scoreEegContactWindow,
} from "./muse-eeg-quality";

export interface CalibrationResult {
  passed: boolean;
  channels: ChannelQuality[];
  overallQuality: number;
  warnings: string[];
}

export interface NoiseThresholds {
  maxVariance: number;
  maxNoiseFloor: number;
}

const DEFAULT_THRESHOLDS: NoiseThresholds = {
  maxVariance: 100000,
  maxNoiseFloor: 500,
};

export function contactScoreToCalibrationResult(score: EegContactScore): CalibrationResult {
  return {
    passed: score.calibrationPassed,
    channels: score.channels,
    overallQuality: score.overallQuality,
    warnings: score.warnings,
  };
}

export class SignalQualityChecker {
  private sampleBuffers: Map<string, number[]> = new Map();
  private calibrationDuration: number = 20000;
  private thresholds: NoiseThresholds;
  private isCalibrating: boolean = false;
  private calibrationStart: number = 0;

  constructor(thresholds: NoiseThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  startCalibration(): void {
    this.sampleBuffers.clear();
    this.isCalibrating = true;
    this.calibrationStart = Date.now();
  }

  addSample(channel: string, samples: number[]): void {
    if (!this.sampleBuffers.has(channel)) {
      this.sampleBuffers.set(channel, []);
    }
    const buffer = this.sampleBuffers.get(channel)!;
    buffer.push(...samples);

    if (buffer.length > 2560) {
      buffer.splice(0, buffer.length - 2560);
    }
  }

  getElapsed(): number {
    return Date.now() - this.calibrationStart;
  }

  isDone(): boolean {
    return this.isCalibrating && this.getElapsed() >= this.calibrationDuration;
  }

  finishCalibration(): CalibrationResult {
    this.isCalibrating = false;
    return contactScoreToCalibrationResult(this.scoreBufferedWindow());
  }

  checkNoiseThreshold(samples: number[]): { passed: boolean; message?: string } {
    const variance = computeVariance(samples);
    const noiseFloor = computeNoiseFloor(samples);

    if (variance > this.thresholds.maxVariance * 2) {
      return { passed: false, message: "Signal too noisy. Movement detected or poor contact." };
    }

    if (noiseFloor > this.thresholds.maxNoiseFloor * 1.5) {
      return { passed: false, message: "High noise floor detected. Check electrode contact." };
    }

    return { passed: true };
  }

  getCurrentQuality(): ChannelQuality[] {
    return this.scoreBufferedWindow().channels;
  }

  private scoreBufferedWindow(): EegContactScore {
    const window: Record<string, number[]> = {};
    for (const ch of EEG_QUALITY_CHANNELS) {
      window[ch] = this.sampleBuffers.get(ch) || [];
    }
    return scoreEegContactWindow(window);
  }
}
