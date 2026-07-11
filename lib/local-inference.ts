/**
 * Local Inference Manager
 *
 * Runs Gemma 4 E2B directly on the main thread via the npm-installed
 * @huggingface/transformers package + WebGPU. No Web Worker needed --
 * WebGPU compute happens asynchronously on the GPU.
 */

export interface InitProgress {
  status: "loading-processor" | "loading-model";
  progress: number; // 0-100
  loaded?: number;
  total?: number;
  file?: string;
}

export interface LocalAnalysisContext {
  planGoal: string;
  currentStep: string;
  recentTranscripts: string[];
  toolEvents: string[];
  facialSummary?: string;
  eegSummary?: string;
  previousProbes: string[];
  tutoringLanguage?: string;
}

const MODEL_ID = "onnx-community/gemma-4-E2B-it-ONNX";

let instance: LocalInferenceManager | null = null;

 
let _processor: any = null;
 
let _model: any = null;

export class LocalInferenceManager {
  private ready = false;
  private initializing = false;

  static getInstance(): LocalInferenceManager {
    if (!instance) {
      instance = new LocalInferenceManager();
    }
    return instance;
  }

  static isWebGPUAvailable(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Load processor + model. Calls onProgress with updates.
   */
  async init(onProgress?: (progress: InitProgress) => void): Promise<void> {
    if (this.ready) return;
    if (this.initializing) {
      return new Promise((resolve, reject) => {
        const check = setInterval(() => {
          if (this.ready) { clearInterval(check); resolve(); }
          if (!this.initializing && !this.ready) {
            clearInterval(check);
            reject(new Error("Model initialization failed"));
          }
        }, 200);
      });
    }

    this.initializing = true;

    try {
      onProgress?.({ status: "loading-processor", progress: 0 });

      // Dynamic import so this only loads client-side
      const tf = await import("@huggingface/transformers");

      _processor = await tf.AutoProcessor.from_pretrained(MODEL_ID);

      onProgress?.({ status: "loading-model", progress: 10 });

      // Track cumulative download progress across all model files.
      // Throttle UI updates to once every 3 seconds to keep things calm.
      const fileProgress = new Map<string, { loaded: number; total: number }>();
      let lastReportedPct = 10;
      let lastReportTime = 0;
      const THROTTLE_MS = 3000;

      _model = await tf.Gemma4ForConditionalGeneration.from_pretrained(MODEL_ID, {
        dtype: "q4f16",
        device: "webgpu",
        progress_callback: (info: { status: string; loaded?: number; total?: number; file?: string; name?: string }) => {
          const fileName = info.file || info.name || "unknown";

          if (info.status === "progress" && info.total) {
            fileProgress.set(fileName, { loaded: info.loaded ?? 0, total: info.total });
          } else if (info.status === "done") {
            const existing = fileProgress.get(fileName);
            if (existing) {
              fileProgress.set(fileName, { loaded: existing.total, total: existing.total });
            }
          }

          // Throttle: only push an update every 3s (or on forward jumps of 5%+)
          const now = Date.now();
          let totalBytes = 0;
          let loadedBytes = 0;
          for (const entry of fileProgress.values()) {
            totalBytes += entry.total;
            loadedBytes += entry.loaded;
          }
          const pct = totalBytes > 0
            ? Math.round(10 + (loadedBytes / totalBytes) * 85)
            : 10;

          const elapsed = now - lastReportTime;
          const jump = pct - lastReportedPct;

          if (pct >= lastReportedPct && (elapsed >= THROTTLE_MS || jump >= 5)) {
            lastReportedPct = pct;
            lastReportTime = now;
            onProgress?.({
              status: "loading-model",
              progress: Math.min(pct, 95),
              loaded: loadedBytes,
              total: totalBytes,
            });
          }
        },
      });

      this.ready = true;
      onProgress?.({ status: "loading-model", progress: 100 });
    } catch (err) {
      this.ready = false;
      throw err;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Transcribe an audio blob to text using Gemma 4's audio understanding.
   */
  async transcribe(audioBlob: Blob): Promise<string> {
    if (!this.ready || !_processor || !_model) {
      throw new Error("Model not initialized");
    }

    const arrayBuffer = await audioBlob.arrayBuffer();

    // Decode and resample to 16kHz mono
    let samples: Float32Array;
    try {
      const tempCtx = new OfflineAudioContext(1, 1, 44100);
      const decoded = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
      const targetSR = 16000;
      const numSamples = Math.round(decoded.duration * targetSR);
      if (numSamples < 100) return "";
      const offlineCtx = new OfflineAudioContext(1, numSamples, targetSR);
      const source = offlineCtx.createBufferSource();
      source.buffer = decoded;
      source.connect(offlineCtx.destination);
      source.start();
      const resampled = await offlineCtx.startRendering();
      samples = resampled.getChannelData(0);
    } catch {
      return "";
    }

    const messages = [
      {
        role: "user",
        content: [
          { type: "audio" },
          { type: "text", text: "Transcribe the audio exactly as spoken. Only output the transcription, no commentary." },
        ],
      },
    ];

    const prompt = _processor.apply_chat_template(messages, {
      enable_thinking: false,
      add_generation_prompt: true,
    });

    const inputs = await _processor(prompt, null, samples, {
      add_special_tokens: false,
    });

    const outputs = await _model.generate({
      ...inputs,
      max_new_tokens: 256,
      do_sample: false,
    });

    const decoded_text = _processor.batch_decode(
      outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
      { skip_special_tokens: true },
    );

    const text = (decoded_text[0] || "").trim();
    const lower = text.toLowerCase();
    if (!text || lower.includes("no speech") || lower.includes("silence") || lower.includes("[no audio]") || text.length < 2) {
      return "";
    }
    return text;
  }

  /**
   * Generate a Socratic probe from session context (text-only).
   */
  async generateProbe(context: LocalAnalysisContext): Promise<string> {
    if (!this.ready || !_processor || !_model) {
      throw new Error("Model not initialized");
    }

    const { planGoal, currentStep, recentTranscripts, toolEvents, facialSummary, eegSummary, previousProbes, tutoringLanguage } = context;

    const lang = tutoringLanguage || "English";
    const transcriptBlock = recentTranscripts.length > 0 ? recentTranscripts.join("\n") : "(no recent speech)";
    const toolBlock = toolEvents.length > 0 ? toolEvents.join(", ") : "(none)";
    const probeBlock = previousProbes.length > 0 ? previousProbes.slice(-5).join("\n- ") : "(none yet)";
    let sensorBlock = "";
    if (facialSummary) sensorBlock += `\nFacial cues: ${facialSummary}`;
    if (eegSummary) sensorBlock += `\nEEG cues: ${eegSummary}`;

    const systemPrompt = `You are a Socratic tutor. You ask one short, targeted question to probe the student's understanding. Respond in ${lang}. Reply with ONLY the question, nothing else.`;
    const userPrompt = `Learning goal: ${planGoal}
Current step: ${currentStep}

Recent student speech:
${transcriptBlock}

Tools used: ${toolBlock}
${sensorBlock}

Previous probes already asked:
- ${probeBlock}

Generate ONE new Socratic question that probes the student's understanding of the current step. Do not repeat previous probes. Be concise.`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: [{ type: "text", text: userPrompt }] },
    ];

    const prompt = _processor.apply_chat_template(messages, {
      enable_thinking: false,
      add_generation_prompt: true,
    });

    const inputs = await _processor(prompt, null, null, {
      add_special_tokens: false,
    });

    const outputs = await _model.generate({
      ...inputs,
      max_new_tokens: 150,
      do_sample: true,
      temperature: 1.0,
      top_p: 0.95,
      top_k: 64,
    });

    const decoded_text = _processor.batch_decode(
      outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
      { skip_special_tokens: true },
    );

    return (decoded_text[0] || "").trim();
  }

  /**
   * Release model resources.
   */
  dispose(): void {
    _processor = null;
    _model = null;
    this.ready = false;
    this.initializing = false;
    instance = null;
  }
}
