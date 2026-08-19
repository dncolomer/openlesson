import { readFileSync } from "node:fs";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatSpeechTranscriptDisplay,
  isIleSpeechCaptureEnabled,
  setSpeechRecognitionConstructorForTests,
  shouldReportSpeechRecognitionError,
  SPEECH_RESTART_DELAY_MS_FOR_TESTS,
  startLiveSpeechRecognition,
  stopLiveSpeechRecognition,
  type LiveSpeechRecognitionBindings,
  type SpeechRecognitionLike,
} from "@/lib/useSessionThoughtInterface";

describe("formatSpeechTranscriptDisplay", () => {
  it("prefers live transcript text", () => {
    expect(
      formatSpeechTranscriptDisplay({
        text: "hello world",
        speechError: null,
        speechSupported: true,
        isListening: true,
        enabled: true,
      }),
    ).toBe("hello world");
  });

  it("shows Listening only when actively listening", () => {
    expect(
      formatSpeechTranscriptDisplay({
        text: "",
        speechError: null,
        speechSupported: true,
        isListening: true,
        enabled: true,
      }),
    ).toBe("Listening…");
  });

  it("prompts Start when enabled but mic is idle (not session-off)", () => {
    const label = formatSpeechTranscriptDisplay({
      text: "",
      speechError: null,
      speechSupported: true,
      isListening: false,
      enabled: true,
    });
    expect(label).toMatch(/Start/i);
    expect(label).not.toMatch(/Speech capture off/i);
  });

  it("does not claim to be waiting when speech capture is off", () => {
    const label = formatSpeechTranscriptDisplay({
      text: "",
      speechError: null,
      speechSupported: true,
      isListening: false,
      enabled: false,
    });
    expect(label).toMatch(/Speech capture off/i);
    expect(label).not.toMatch(/Waiting for speech/i);
  });
});

describe("isIleSpeechCaptureEnabled", () => {
  it("arms only when recording, not paused, and welcome not covering Helios", () => {
    expect(
      isIleSpeechCaptureEnabled({
        isRecording: true,
        isPaused: false,
        showWelcomePanel: false,
      }),
    ).toBe(true);
    expect(
      isIleSpeechCaptureEnabled({
        isRecording: false,
        isPaused: false,
        showWelcomePanel: false,
      }),
    ).toBe(false);
    expect(
      isIleSpeechCaptureEnabled({
        isRecording: true,
        isPaused: true,
        showWelcomePanel: false,
      }),
    ).toBe(false);
    expect(
      isIleSpeechCaptureEnabled({
        isRecording: true,
        isPaused: false,
        showWelcomePanel: true,
      }),
    ).toBe(false);
  });
});

describe("shouldReportSpeechRecognitionError", () => {
  it("treats no-speech and aborted as benign continuous-mode ends", () => {
    expect(shouldReportSpeechRecognitionError("no-speech")).toBe(false);
    expect(shouldReportSpeechRecognitionError("aborted")).toBe(false);
    expect(shouldReportSpeechRecognitionError("not-allowed")).toBe(true);
  });
});

type FakeRecognition = SpeechRecognitionLike & {
  triggerStart: () => void;
  triggerEnd: () => void;
  triggerResult: (transcript: string, isFinal?: boolean) => void;
  startCount: number;
};

function createFakeRecognitionFactory() {
  const instances: FakeRecognition[] = [];

  class FakeSpeechRecognition {
    continuous = false;
    interimResults = false;
    lang = "";
    onresult: SpeechRecognitionLike["onresult"] = null;
    onerror: SpeechRecognitionLike["onerror"] = null;
    onstart: SpeechRecognitionLike["onstart"] = null;
    onend: SpeechRecognitionLike["onend"] = null;
    startCount = 0;
    private started = false;

    constructor() {
      instances.push(this as unknown as FakeRecognition);
    }

    start() {
      if (this.started) {
        throw new Error(
          "Failed to execute 'start' on 'SpeechRecognition': recognition has already started.",
        );
      }
      this.started = true;
      this.startCount += 1;
    }

    abort() {
      if (!this.started) return;
      this.started = false;
      this.onend?.();
    }

    triggerStart() {
      this.onstart?.();
    }

    triggerEnd() {
      this.started = false;
      this.onend?.();
    }

    triggerResult(transcript: string, isFinal = true) {
      const result = {
        isFinal,
        0: { transcript },
      };
      const event = {
        resultIndex: 0,
        results: { length: 1, 0: result },
      };
      this.onresult?.(event as never);
    }
  }

  return {
    Ctor: FakeSpeechRecognition as unknown as new () => SpeechRecognitionLike,
    instances,
  };
}

function createBindings() {
  const recognitionRef = { current: null as SpeechRecognitionLike | null };
  const shouldListenRef = { current: false };
  const restartTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
  const langRef = { current: "en-US" };
  let listening = false;
  let error: string | null = null;
  let lastTranscript = "";

  const bindings: LiveSpeechRecognitionBindings = {
    recognitionRef,
    shouldListenRef,
    restartTimerRef,
    langRef,
    onResult: (event) => {
      const piece = event.results[0]?.[0]?.transcript ?? "";
      lastTranscript = piece;
    },
    onListeningChange: (next) => {
      listening = next;
    },
    onError: (next) => {
      error = next;
    },
  };

  return {
    bindings,
    get listening() {
      return listening;
    },
    get error() {
      return error;
    },
    get lastTranscript() {
      return lastTranscript;
    },
    get shouldListen() {
      return shouldListenRef.current;
    },
  };
}

describe("live speech recognition helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    setSpeechRecognitionConstructorForTests(undefined);
    vi.useRealTimers();
  });

  it("start arms should-listen; onstart yields listening; results surface transcript", () => {
    const factory = createFakeRecognitionFactory();
    setSpeechRecognitionConstructorForTests(factory.Ctor);

    const harness = createBindings();
    const recognition = startLiveSpeechRecognition(harness.bindings, "en-US") as FakeRecognition;
    expect(recognition).toBeTruthy();
    expect(harness.shouldListen).toBe(true);
    // Listening is not optimistic — only onstart flips it.
    expect(harness.listening).toBe(false);

    recognition.triggerStart();
    expect(harness.listening).toBe(true);
    expect(harness.error).toBeNull();

    recognition.triggerResult("quantum bits", true);
    expect(harness.lastTranscript).toBe("quantum bits");
  });

  it("onend schedules restart while should-listen remains true", () => {
    const factory = createFakeRecognitionFactory();
    setSpeechRecognitionConstructorForTests(factory.Ctor);

    const harness = createBindings();
    const recognition = startLiveSpeechRecognition(harness.bindings, "en-US") as FakeRecognition;
    recognition.triggerStart();
    expect(harness.listening).toBe(true);

    const startsBefore = recognition.startCount;
    recognition.triggerEnd();
    expect(harness.listening).toBe(false);

    vi.advanceTimersByTime(SPEECH_RESTART_DELAY_MS_FOR_TESTS + 20);
    expect(recognition.startCount).toBeGreaterThan(startsBefore);
    recognition.triggerStart();
    expect(harness.listening).toBe(true);
  });

  it("stop clears listening and prevents restart", () => {
    const factory = createFakeRecognitionFactory();
    setSpeechRecognitionConstructorForTests(factory.Ctor);
    const harness = createBindings();
    const recognition = startLiveSpeechRecognition(harness.bindings, "en-US") as FakeRecognition;
    recognition.triggerStart();
    expect(harness.listening).toBe(true);

    stopLiveSpeechRecognition(harness.bindings);
    expect(harness.shouldListen).toBe(false);
    expect(harness.listening).toBe(false);

    vi.advanceTimersByTime(SPEECH_RESTART_DELAY_MS_FOR_TESTS + 50);
    expect(harness.listening).toBe(false);
  });

  it("retry after stop can start again", () => {
    const factory = createFakeRecognitionFactory();
    setSpeechRecognitionConstructorForTests(factory.Ctor);
    const harness = createBindings();

    let recognition = startLiveSpeechRecognition(harness.bindings, "en-US") as FakeRecognition;
    recognition.triggerStart();
    stopLiveSpeechRecognition(harness.bindings);
    expect(harness.listening).toBe(false);

    recognition = startLiveSpeechRecognition(harness.bindings, "en-US") as FakeRecognition;
    expect(harness.shouldListen).toBe(true);
    recognition.triggerStart();
    expect(harness.listening).toBe(true);
  });
});

describe("ILE + TAP speech wiring (structural)", () => {
  it("SessionView enables speech via isIleSpeechCaptureEnabled and starts recording when welcome is skipped", () => {
    const viewSrc = readSessionViewSurface();
    expect(viewSrc).toContain("isIleSpeechCaptureEnabled");
    expect(viewSrc).toContain("powSessionEnabled");
    expect(viewSrc).toContain("enabled: powSessionEnabled");
    // Returning sessions arm capture without the welcome Play path.
    expect(viewSrc).toMatch(/if \(!isFreshSession\)[\s\S]*await startRecording\(\)/);
    expect(viewSrc).toMatch(/needsWelcome[\s\S]*await startRecording\(\)/);
  });

  it("TAP live phase starts recognition and keeps display enabled while live", () => {
    const tapSrc = readFileSync(
      path.join(process.cwd(), "components/TapScoreClient.tsx"),
      "utf8",
    );
    expect(tapSrc).toContain("isTapLiveThoughtSpeechEnabled");
    expect(tapSrc).toContain("tapHookFormingText");
    expect(tapSrc).toContain("stopLiveSpeechRecognition");
    expect(tapSrc).toContain('phase === "live"');
    expect(tapSrc).toContain("isTapLiveThoughtSpeechEnabled(phase)");
    expect(tapSrc).toContain("retryMicrophone");
  });
});
