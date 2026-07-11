/**
 * Local Context - Moving Window Buffer
 *
 * Maintains a sliding window of recent session data for local inference.
 * Local buffer for session context used during in-browser inference.
 */

interface TimestampedEntry<T> {
  data: T;
  timestamp: number;
}

const TRANSCRIPT_WINDOW_MS = 3 * 60 * 1000; // 3 minutes
const SENSOR_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_SCREENSHOTS = 3;

export interface LocalContextSnapshot {
  recentTranscripts: string[];
  toolEvents: string[];
  facialSummary: string | undefined;
  eegSummary: string | undefined;
}

export class LocalContextBuffer {
  private transcripts: TimestampedEntry<string>[] = [];
  private toolEvents: TimestampedEntry<string>[] = [];
  private facialData: TimestampedEntry<Record<string, number>>[] = [];
  private eegData: TimestampedEntry<Record<string, number>>[] = [];
  private screenshots: TimestampedEntry<Blob>[] = [];

  /**
   * Add a locally-generated transcript.
   */
  addTranscript(text: string): void {
    if (!text.trim()) return;
    this.transcripts.push({ data: text, timestamp: Date.now() });
    this.pruneOld(this.transcripts, TRANSCRIPT_WINDOW_MS);
  }

  /**
   * Add a tool event description (e.g. "opened canvas", "used chat").
   */
  addToolEvent(event: string): void {
    this.toolEvents.push({ data: event, timestamp: Date.now() });
    this.pruneOld(this.toolEvents, SENSOR_WINDOW_MS);
  }

  /**
   * Add facial analysis data snapshot.
   */
  addFacialData(scores: Record<string, number>): void {
    this.facialData.push({ data: scores, timestamp: Date.now() });
    this.pruneOld(this.facialData, SENSOR_WINDOW_MS);
  }

  /**
   * Add EEG band power data snapshot.
   */
  addEEGData(bands: Record<string, number>): void {
    this.eegData.push({ data: bands, timestamp: Date.now() });
    this.pruneOld(this.eegData, SENSOR_WINDOW_MS);
  }

  /**
   * Add a screenshot blob.
   */
  addScreenshot(blob: Blob): void {
    this.screenshots.push({ data: blob, timestamp: Date.now() });
    this.pruneOld(this.screenshots, SENSOR_WINDOW_MS);
    // Keep at most MAX_SCREENSHOTS
    if (this.screenshots.length > MAX_SCREENSHOTS) {
      this.screenshots = this.screenshots.slice(-MAX_SCREENSHOTS);
    }
  }

  /**
   * Get the most recent screenshot blob (if any).
   */
  getLatestScreenshot(): Blob | null {
    return this.screenshots.length > 0
      ? this.screenshots[this.screenshots.length - 1].data
      : null;
  }

  /**
   * Assemble current context snapshot for probe generation.
   */
  getContext(): LocalContextSnapshot {
    const now = Date.now();

    // Prune before reading
    this.pruneOld(this.transcripts, TRANSCRIPT_WINDOW_MS);
    this.pruneOld(this.toolEvents, SENSOR_WINDOW_MS);
    this.pruneOld(this.facialData, SENSOR_WINDOW_MS);
    this.pruneOld(this.eegData, SENSOR_WINDOW_MS);

    // Summarize facial data: average scores over the window
    let facialSummary: string | undefined;
    if (this.facialData.length > 0) {
      const keys = Object.keys(this.facialData[0].data);
      const avgs: Record<string, number> = {};
      for (const key of keys) {
        const sum = this.facialData.reduce((acc, e) => acc + (e.data[key] || 0), 0);
        avgs[key] = Math.round((sum / this.facialData.length) * 100) / 100;
      }
      const parts = Object.entries(avgs).map(([k, v]) => `${k}=${v}`);
      facialSummary = parts.join(", ");
    }

    // Summarize EEG data: average band powers
    let eegSummary: string | undefined;
    if (this.eegData.length > 0) {
      const keys = Object.keys(this.eegData[0].data);
      const avgs: Record<string, number> = {};
      for (const key of keys) {
        const sum = this.eegData.reduce((acc, e) => acc + (e.data[key] || 0), 0);
        avgs[key] = Math.round((sum / this.eegData.length) * 100) / 100;
      }
      const parts = Object.entries(avgs).map(([k, v]) => `${k}=${v}`);
      eegSummary = parts.join(", ");
    }

    return {
      recentTranscripts: this.transcripts.map((e) => e.data),
      toolEvents: [...new Set(this.toolEvents.map((e) => e.data))], // deduplicate
      facialSummary,
      eegSummary,
    };
  }

  /**
   * Clear all buffered data.
   */
  clear(): void {
    this.transcripts = [];
    this.toolEvents = [];
    this.facialData = [];
    this.eegData = [];
    this.screenshots = [];
  }

  private pruneOld<T>(arr: TimestampedEntry<T>[], windowMs: number): void {
    const cutoff = Date.now() - windowMs;
    while (arr.length > 0 && arr[0].timestamp < cutoff) {
      arr.shift();
    }
  }
}
