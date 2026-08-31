// ============================================
// LABS MUSE MANAGER - Extended sensor streaming for Mastery Check
// Handles EEG + fNIRS + PPG + IMU from Muse S Athena
// ============================================

import {
  MuseAthenaClient,
  type EEGSample,
  type PPGSample,
  type IMUSample,
  type FNIRSSample,
  type DeviceStatus,
  EEG_CHANNELS,
  isWebBluetoothSupported,
} from "./muse-athena";

export interface LabsMuseData {
  eeg: EEGSample | null;
  ppg: PPGSample | null;
  imu: IMUSample | null;
  fnirs: FNIRSSample | null;
  deviceStatus: DeviceStatus;
  timestamp: number;
}

export interface BandPowers {
  timestamp: number;
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  gamma: number;
  // Asymmetry metrics
  asymmetry: number;
  // Engagement metrics
  engagement: number;
}

export interface PPGMetrics {
  timestamp: number;
  heartRate: number;
  hrvRMSSD: number;
  hrvSDNN: number;
  spO2: number;
}

export interface IMUMetrics {
  timestamp: number;
  movementVariance: number;
  headStability: number;
  breathingRate: number;
}

export interface FNIRSMetrics {
  timestamp: number;
  hbo: number;
  hbr: number;
  hbt: number;
  cognitiveLoad: number;
  prefrontalEfficiency: number;
}

export type LabsStatus = "disconnected" | "connecting" | "connected" | "calibrating" | "streaming";

type DataCallback = (data: LabsMuseData) => void;
type BandPowerCallback = (powers: BandPowers) => void;
type PPGCallback = (metrics: PPGMetrics) => void;
type IMUCallback = (metrics: IMUMetrics) => void;
type FNIRSCallback = (metrics: FNIRSMetrics) => void;
type StatusCallback = (status: LabsStatus) => void;

export class LabsMuseManager {
  private client: MuseAthenaClient;
  
  private _status: LabsStatus = "disconnected";
  private sessionStartTime: number = 0;
  
  // Data buffers
  private eegBuffer: Map<string, number[]> = new Map();
  private ppgBuffer: number[] = [];
  private imuBuffer: { accel: number[]; gyro: number[] }[] = [];
  
  // Feature computation state
  private fftBuffer: Map<number, number[]> = new Map();
  private ppgPeaks: number[] = [];
  private lastPPGPeakTime: number = 0;
  
  // Callbacks
  private dataCallbacks: DataCallback[] = [];
  private bandPowerCallbacks: BandPowerCallback[] = [];
  private ppgCallbacks: PPGCallback[] = [];
  private imuCallbacks: IMUCallback[] = [];
  private fnirsCallbacks: FNIRSCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  
  // Intervals
  private featureInterval: NodeJS.Timeout | null = null;
  private unsubEEG: (() => void) | null = null;
  private unsubPPG: (() => void) | null = null;
  private unsubIMU: (() => void) | null = null;
  private unsubFNIRS: (() => void) | null = null;
  private unsubStatus: (() => void) | null = null;

  deviceName: string | null = null;
  battery: number = 0;

  constructor() {
    this.client = new MuseAthenaClient();
  }

  async connect(): Promise<void> {
    this.setStatus("connecting");
    
    this.unsubStatus = this.client.onStatusChange((s) => {
      if (s === "connected") this.setStatus("connected");
      else if (s === "disconnected") this.setStatus("disconnected");
    });

    try {
      await this.client.connect();
      this.deviceName = this.client.deviceName;
      this.battery = this.client.battery;
      this.setStatus("connected");
    } catch (err) {
      this.setStatus("disconnected");
      throw err;
    }
  }

  async startCalibration(): Promise<void> {
    this.sessionStartTime = Date.now();
    this.clearBuffers();
    this.setStatus("calibrating");
    
    this.setupSubscriptions();
    await this.client.startStreaming();
    
    this.featureInterval = setInterval(() => this.computeFeatures(), 1000);
  }

  async startSession(): Promise<void> {
    if (this._status !== "calibrating") {
      await this.startCalibration();
    }
    this.setStatus("streaming");
  }

  async stopSession(): Promise<void> {
    if (this.featureInterval) {
      clearInterval(this.featureInterval);
      this.featureInterval = null;
    }
    
    this.cleanupSubscriptions();
    
    try {
      await this.client.stopStreaming();
    } catch {}
    
    this.setStatus("connected");
  }

  disconnect(): void {
    this.stopSession();
    
    if (this.unsubStatus) {
      this.unsubStatus();
      this.unsubStatus = null;
    }
    
    this.client.disconnect();
    this.setStatus("disconnected");
  }

  private setupSubscriptions(): void {
    this.unsubEEG = this.client.onEEG((sample) => {
      this.handleEEG(sample);
    });
    
    this.unsubPPG = this.client.onPPG((sample) => {
      this.handlePPG(sample);
    });
    
    this.unsubIMU = this.client.onIMU((sample) => {
      this.handleIMU(sample);
    });
    
    this.unsubFNIRS = this.client.onFNIRS((sample) => {
      this.handleFNIRS(sample);
    });
  }

  private cleanupSubscriptions(): void {
    if (this.unsubEEG) { this.unsubEEG(); this.unsubEEG = null; }
    if (this.unsubPPG) { this.unsubPPG(); this.unsubPPG = null; }
    if (this.unsubIMU) { this.unsubIMU(); this.unsubIMU = null; }
    if (this.unsubFNIRS) { this.unsubFNIRS(); this.unsubFNIRS = null; }
  }

  private clearBuffers(): void {
    this.eegBuffer.clear();
    this.ppgBuffer = [];
    this.imuBuffer = [];
    this.fftBuffer.clear();
    this.ppgPeaks = [];
  }

  private handleEEG(sample: EEGSample): void {
    const timestamp = Date.now() - this.sessionStartTime;
    
    for (const [channel, samples] of Object.entries(sample.channels)) {
      if (!this.eegBuffer.has(channel)) {
        this.eegBuffer.set(channel, []);
      }
      this.eegBuffer.get(channel)!.push(...samples);
      
      // FFT buffer for band powers
      const chIdx = EEG_CHANNELS.indexOf(channel as typeof EEG_CHANNELS[number]);
      if (chIdx >= 0) {
        if (!this.fftBuffer.has(chIdx)) {
          this.fftBuffer.set(chIdx, []);
        }
        this.fftBuffer.get(chIdx)!.push(...samples);
        
        // Keep last 512 samples
        if (this.fftBuffer.get(chIdx)!.length > 512) {
          this.fftBuffer.set(chIdx, this.fftBuffer.get(chIdx)!.slice(-512));
        }
      }
    }
    
    this.emitData({
      eeg: sample,
      ppg: null,
      imu: null,
      fnirs: null,
      deviceStatus: this.getDeviceStatus(),
      timestamp,
    });
  }

  private handlePPG(sample: PPGSample): void {
    this.ppgBuffer.push(...sample.samples);
    
    // Keep last 256 samples (~4 seconds at 64Hz)
    if (this.ppgBuffer.length > 256) {
      this.ppgBuffer = this.ppgBuffer.slice(-256);
    }
    
    // Peak detection for HRV
    const threshold = Math.min(...this.ppgBuffer) + (Math.max(...this.ppgBuffer) - Math.min(...this.ppgBuffer)) * 0.7;
    const latest = sample.samples[sample.samples.length - 1];
    
    if (latest > threshold && (Date.now() - this.lastPPGPeakTime) > 400) {
      this.ppgPeaks.push(Date.now());
      if (this.ppgPeaks.length > 30) {
        this.ppgPeaks.shift();
      }
      this.lastPPGPeakTime = Date.now();
    }
  }

  private handleIMU(sample: IMUSample): void {
    this.imuBuffer.push({ accel: [...sample.accel], gyro: [...sample.gyro] });
    
    // Keep last ~5 seconds at 52Hz
    if (this.imuBuffer.length > 260) {
      this.imuBuffer = this.imuBuffer.slice(-260);
    }
  }

  private handleFNIRS(sample: FNIRSSample): void {
    this.emitData({
      eeg: null,
      ppg: null,
      imu: null,
      fnirs: sample,
      deviceStatus: this.getDeviceStatus(),
      timestamp: Date.now() - this.sessionStartTime,
    });
  }

  private getDeviceStatus(): DeviceStatus {
    return {
      battery: this.client.battery,
      electrodeQuality: this.client.electrodeQuality,
      signalQuality: this.client.signalQuality,
      firmware: this.client.deviceInfo.firmware,
      contactEvaluated: this.client.contactEvaluated,
      calibrationPassed: this.client.calibrationPassed,
      channelStatuses: this.client.channelStatuses,
    };
  }

  private computeFeatures(): void {
    const timestamp = Date.now() - this.sessionStartTime;
    
    // Band powers (EEG)
    const bandPowers = this.computeBandPowers(timestamp);
    if (bandPowers) {
      this.bandPowerCallbacks.forEach((cb) => cb(bandPowers));
    }
    
    // PPG metrics
    const ppgMetrics = this.computePPGMetrics(timestamp);
    if (ppgMetrics) {
      this.ppgCallbacks.forEach((cb) => cb(ppgMetrics));
    }
    
    // IMU metrics
    const imuMetrics = this.computeIMUMetrics(timestamp);
    if (imuMetrics) {
      this.imuCallbacks.forEach((cb) => cb(imuMetrics));
    }
  }

  private computeBandPowers(timestamp: number): BandPowers | null {
    // Use forehead channels (AF7=1, AF8=2)
    const channels = [1, 2];
    const channelPowers: BandPowers[] = [];
    
    for (const ch of channels) {
      const samples = this.fftBuffer.get(ch);
      if (!samples || samples.length < 256) continue;
      
      const window = samples.slice(-256);
      const powers = this.fft256ToBands(window);
      channelPowers.push(powers);
    }
    
    if (channelPowers.length === 0) return null;
    
    // Average across channels
    const avg: BandPowers = {
      timestamp,
      delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0,
      asymmetry: 0,
      engagement: 0,
    };
    
    for (const p of channelPowers) {
      avg.delta += p.delta;
      avg.theta += p.theta;
      avg.alpha += p.alpha;
      avg.beta += p.beta;
      avg.gamma += p.gamma;
    }
    
    const n = channelPowers.length;
    avg.delta /= n;
    avg.theta /= n;
    avg.alpha /= n;
    avg.beta /= n;
    avg.gamma /= n;
    
    // Compute asymmetry (left-right)
    const leftSamples = this.fftBuffer.get(1) || [];
    const rightSamples = this.fftBuffer.get(2) || [];
    if (leftSamples.length >= 256 && rightSamples.length >= 256) {
      const leftPower = this.computeAlphaPower(leftSamples.slice(-256));
      const rightPower = this.computeAlphaPower(rightSamples.slice(-256));
      avg.asymmetry = (rightPower - leftPower) / (leftPower + rightPower + 0.001);
    }
    
    // Engagement: beta / (theta + alpha)
    const total = avg.theta + avg.alpha + 0.001;
    avg.engagement = avg.beta / total;
    
    return avg;
  }

  private computeAlphaPower(samples: number[]): number {
    return this.fft256ToBands(samples).alpha;
  }

  private computePPGMetrics(timestamp: number): PPGMetrics | null {
    if (this.ppgPeaks.length < 2) {
      return {
        timestamp,
        heartRate: 0,
        hrvRMSSD: 0,
        hrvSDNN: 0,
        spO2: 0,
      };
    }
    
    // Calculate HR from peak intervals
    const intervals: number[] = [];
    for (let i = 1; i < this.ppgPeaks.length; i++) {
      intervals.push(this.ppgPeaks[i] - this.ppgPeaks[i - 1]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const heartRate = avgInterval > 0 ? 60000 / avgInterval : 0;
    
    // RMSSD
    let rmssd = 0;
    if (intervals.length > 1) {
      const meanInterval = avgInterval;
      const squaredDiffs = intervals.map(i => Math.pow(i - meanInterval, 2));
      rmssd = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / intervals.length);
    }
    
    // SDNN
    const sdnn = Math.sqrt(
      intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length
    );
    
    return {
      timestamp,
      heartRate: Math.min(200, Math.max(40, heartRate)),
      hrvRMSSD: rmssd,
      hrvSDNN: sdnn,
      spO2: 98, // Placeholder - real SpO2 would come from fNIRS
    };
  }

  private computeIMUMetrics(timestamp: number): IMUMetrics | null {
    if (this.imuBuffer.length < 10) {
      return { timestamp, movementVariance: 0, headStability: 1, breathingRate: 0 };
    }
    
    // Movement variance from accelerometer
    const accelX = this.imuBuffer.map(b => b.accel[0]);
    const accelY = this.imuBuffer.map(b => b.accel[1]);
    const accelZ = this.imuBuffer.map(b => b.accel[2]);
    
    const xVar = computeVariance(accelX);
    const yVar = computeVariance(accelY);
    const zVar = computeVariance(accelZ);
    const movementVariance = Math.sqrt(xVar + yVar + zVar);
    
    // Head stability (inverse of movement, smoothed)
    const headStability = Math.max(0, Math.min(1, 1 - movementVariance / 10));
    
    // Breathing rate (simplified - from Z acceleration oscillation)
    const breathingRate = 0; // Simplified - would need proper frequency analysis
    
    return { timestamp, movementVariance, headStability, breathingRate };
  }

  private fft256ToBands(samples: number[]): BandPowers {
    const n = samples.length;
    const sampleRate = 256;
    
    const windowed = samples.map((s, i) =>
      s * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)))
    );
    
    const bandRanges: [string, [number, number]][] = [
      ["delta", [1, 4]],
      ["theta", [4, 8]],
      ["alpha", [8, 13]],
      ["beta", [13, 30]],
      ["gamma", [30, 44]],
    ];
    
    const powers: Record<string, number> = {};
    
    for (const [band, [fLow, fHigh]] of bandRanges) {
      let power = 0;
      const binLow = Math.floor((fLow * n) / sampleRate);
      const binHigh = Math.min(Math.ceil((fHigh * n) / sampleRate), n / 2);
      
      for (let k = binLow; k <= binHigh; k++) {
        let re = 0, im = 0;
        for (let j = 0; j < n; j++) {
          const angle = (2 * Math.PI * k * j) / n;
          re += windowed[j] * Math.cos(angle);
          im -= windowed[j] * Math.sin(angle);
        }
        power += (re * re + im * im) / (n * n);
      }
      powers[band] = power;
    }
    
    return {
      timestamp: 0,
      delta: powers.delta || 0,
      theta: powers.theta || 0,
      alpha: powers.alpha || 0,
      beta: powers.beta || 0,
      gamma: powers.gamma || 0,
      asymmetry: 0,
      engagement: 0,
    };
  }

  private emitData(data: LabsMuseData): void {
    this.dataCallbacks.forEach((cb) => cb(data));
  }

  private setStatus(status: LabsStatus) {
    this._status = status;
    this.statusCallbacks.forEach((cb) => cb(status));
  }

  // Public API
  getStatus(): LabsStatus { return this._status; }
  
  onData(cb: DataCallback): () => void {
    this.dataCallbacks.push(cb);
    return () => { this.dataCallbacks = this.dataCallbacks.filter(c => c !== cb); };
  }
  
  onBandPowers(cb: BandPowerCallback): () => void {
    this.bandPowerCallbacks.push(cb);
    return () => { this.bandPowerCallbacks = this.bandPowerCallbacks.filter(c => c !== cb); };
  }
  
  onPPGMetrics(cb: PPGCallback): () => void {
    this.ppgCallbacks.push(cb);
    return () => { this.ppgCallbacks = this.ppgCallbacks.filter(c => c !== cb); };
  }
  
  onIMUMetrics(cb: IMUCallback): () => void {
    this.imuCallbacks.push(cb);
    return () => { this.imuCallbacks = this.imuCallbacks.filter(c => c !== cb); };
  }
  
  onFNIRSMetrics(cb: FNIRSCallback): () => void {
    this.fnirsCallbacks.push(cb);
    return () => { this.fnirsCallbacks = this.fnirsCallbacks.filter(c => c !== cb); };
  }
  
  onStatusChange(cb: StatusCallback): () => void {
    this.statusCallbacks.push(cb);
    return () => { this.statusCallbacks = this.statusCallbacks.filter(c => c !== cb); };
  }

  getEEGBuffer(): Map<string, number[]> { return this.eegBuffer; }
}

function computeVariance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / arr.length;
}

let labsMuseInstance: LabsMuseManager | null = null;

export function getLabsMuseManager(): LabsMuseManager {
  if (!labsMuseInstance) {
    labsMuseInstance = new LabsMuseManager();
  }
  return labsMuseInstance;
}

export function isMuseSupported(): boolean {
  return isWebBluetoothSupported();
}