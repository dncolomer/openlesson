// ============================================
// AUDIO RECORDING UTILITIES
// Chunked recording with sliding window buffer
// ============================================

export interface AudioChunk {
  blob: Blob;
  timestamp: number;
  duration: number;
  chunkIndex: number;
}

export interface AudioRecorderConfig {
  chunkDurationMs: number;
  maxBufferDurationMs: number;
  onChunk?: (chunk: AudioChunk) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_CONFIG: AudioRecorderConfig = {
  chunkDurationMs: 60000, // 1 minute
  maxBufferDurationMs: 300000, // 5 minutes sliding window
};

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private ownsStream: boolean = false;
  private chunks: AudioChunk[] = [];
  private allChunks: Blob[] = [];
  /** First data event blob — contains the container header (EBML / ftyp+moov / OggS).
   *  Prepended to every subsequent fragment so each upload is a valid standalone file. */
  private headerBlob: Blob | null = null;
  private config: AudioRecorderConfig;
  private startTime: number = 0;
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private chunkIndex: number = 0;

  constructor(config: Partial<AudioRecorderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(existingStream?: MediaStream): Promise<void> {
    if (this.isRecording) {
      throw new Error("Already recording");
    }

    try {
      if (existingStream) {
        this.stream = existingStream;
        this.ownsStream = false;
      } else {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 48000,
          },
        });
        this.ownsStream = true;
      }

      this.stream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });

      const mimeType = this.getSupportedMimeType();

      const recorderOptions: MediaRecorderOptions = { mimeType };
      if (this.stream?.getAudioTracks().length) {
        recorderOptions.audioBitsPerSecond = 64000;
      }

      this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);

      this.startTime = Date.now();
      this.chunks = [];
      this.allChunks = [];
      this.headerBlob = null;
      this.isRecording = true;
      this.chunkIndex = 0;

      this.mediaRecorder.ondataavailable = (event) => {
        console.log("[AudioRecorder] ondataavailable fired", { size: event.data.size, timeSlice: this.config.chunkDurationMs });
        if (event.data.size > 0) {
          // The first data event includes the container header (EBML for WebM,
          // ftyp/moov for MP4, OggS page for OGG). Subsequent events are bare
          // codec frames that are NOT standalone valid files.
          // We save the first event as the header and prepend it to every
          // subsequent fragment so each upload is a valid standalone file that
          // xAI STT can decode.
          if (this.headerBlob === null) {
            this.headerBlob = event.data;
          }

          // Build a standalone blob: header + current fragment.
          // For chunk 0 this is just the header itself (already valid).
          const standaloneBlob =
            this.chunkIndex === 0
              ? event.data
              : new Blob([this.headerBlob, event.data], { type: this.getMimeType() });

          const chunk: AudioChunk = {
            blob: standaloneBlob,
            timestamp: Date.now() - this.startTime,
            duration: this.config.chunkDurationMs,
            chunkIndex: this.chunkIndex,
          };

          console.log("[AudioRecorder] Creating chunk", { chunkIndex: chunk.chunkIndex, timestamp: chunk.timestamp, blobSize: chunk.blob.size });
          this.chunks.push(chunk);
          this.allChunks.push(event.data);
          this.trimBuffer();
          this.chunkIndex++;
          console.log("[AudioRecorder] Calling onChunk callback");
          this.config.onChunk?.(chunk);
        } else {
          console.log("[AudioRecorder] ondataavailable called but event.data.size is 0");
        }
      };

      this.mediaRecorder.onerror = (event) => {
        const error = new Error(`MediaRecorder error: ${event}`);
        this.config.onError?.(error);
      };

      console.log("[AudioRecorder] About to start with timeslice: 5000");
      this.mediaRecorder.start(5000);
      console.log("[AudioRecorder] Started, state:", this.mediaRecorder.state);
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isRecording) {
        resolve();
        return;
      }

      this.isRecording = false;
      this.isPaused = false;

      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        const finalDataHandler = (event: Event) => {
          const blobEvent = event as BlobEvent;
          if (blobEvent.data && blobEvent.data.size > 0) {
            this.allChunks.push(blobEvent.data);
          }
          this.mediaRecorder?.removeEventListener("dataavailable", finalDataHandler);
          this.cleanup();
          resolve();
        };
        
        this.mediaRecorder.addEventListener("dataavailable", finalDataHandler);
        this.mediaRecorder.stop();
      } else {
        this.cleanup();
        resolve();
      }
    });
  }

  pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.pause();
      this.isPaused = true;
    }
  }

  resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "paused") {
      this.mediaRecorder.resume();
      this.isPaused = false;
    }
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  private cleanup(): void {
    if (this.stream && this.ownsStream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    this.stream = null;
    this.ownsStream = false;
    this.mediaRecorder = null;
  }

  private trimBuffer(): void {
    const maxChunks = Math.ceil(
      this.config.maxBufferDurationMs / this.config.chunkDurationMs
    );

    while (this.chunks.length > maxChunks) {
      this.chunks.shift();
    }
  }

  private getSupportedMimeType(): string {
    // Prefer formats supported by xAI STT (WAV, MP3, OGG, Opus, FLAC, AAC,
    // MP4, M4A, MKV). WebM is NOT natively supported, but webm+opus is the
    // most universally available MediaRecorder format across browsers
    // (Chrome, Firefox, Safari 18.4+). When webm is selected, the storage
    // layer re-labels it as .ogg and the STT routes send audio/ogg — the
    // raw opus frames are identical in both containers.
    const types = [
      "audio/mp4",               // Safari (always valid standalone chunks)
      "audio/ogg;codecs=opus",   // Firefox
      "audio/webm;codecs=opus",  // Chrome, Edge, Safari 18.4+
      "audio/ogg",
      "audio/aac",
      "audio/webm",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return "audio/webm;codecs=opus";
  }

  getRecentAudio(durationMs?: number): Blob | null {
    if (this.chunks.length === 0) return null;

    // Each chunk's blob is already a standalone valid file (header + payload).
    // Return the most recent chunk that covers the requested duration.
    // With timeslice=5000ms and chunkDurationMs=60000ms each chunk is ~5s,
    // so for a 5s request we just return the last chunk.
    if (durationMs) {
      const chunksNeeded = Math.ceil(durationMs / 5000); // timeslice is 5s
      const selected = this.chunks.slice(-chunksNeeded);
      if (selected.length === 1) {
        // Single chunk — already a valid standalone file
        return selected[0].blob;
      }
      // Multiple chunks requested — return the most recent one since each is standalone.
      // Concatenating standalone files would produce an invalid file.
      return selected[selected.length - 1].blob;
    }

    // No duration specified — return the last chunk
    return this.chunks[this.chunks.length - 1].blob;
  }

  getFullAudio(): Blob | null {
    if (this.allChunks.length === 0) return null;
    return new Blob(this.allChunks, { type: this.getMimeType() });
  }

  getAudioFormat(): string {
    const mimeType = this.getMimeType();
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("ogg")) return "ogg";
    if (mimeType.includes("aac")) return "aac";
    // webm with opus codec → treat as ogg for xAI compatibility
    if (mimeType.includes("webm")) return "ogg";
    return "mp4";
  }

  private getMimeType(): string {
    return this.mediaRecorder?.mimeType || "audio/mp4";
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  getElapsedTime(): number {
    if (!this.isRecording) return 0;
    return Date.now() - this.startTime;
  }

  getBufferDuration(): number {
    return this.chunks.length * this.config.chunkDurationMs;
  }

  getChunkCount(): number {
    return this.chunks.length;
  }

  getCurrentChunkIndex(): number {
    return this.chunkIndex;
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function downloadAudio(blob: Blob, filename: string = "recording.webm"): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
