import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import fs from "fs";
import path from "path";
import {
  isFormingThought,
  isSilenceOriginatedInterruption,
  shouldSendIdleProofOfWork,
  shouldSkipSilenceInterruptionWhileFormingThought,
} from "@/lib/tap-interruption-gate";
import { createTapInterruptionScheduler } from "@/lib/useTapPredictiveInterruption";
import type { ProofOfWorkApiInterruption } from "@/lib/pow-api/predictive-interruption";

const ROOT = process.cwd();

function sampleInterruption(id: string, delayMs = 5_000): NonNullable<ProofOfWorkApiInterruption> {
  return {
    interruption_id: id,
    delay_ms: delayMs,
    intervention: { type: "reflection_prompt", message: `Msg ${id}` },
    confidence: "medium",
    predicted_at: new Date().toISOString(),
  };
}

describe("tap-interruption-gate pure helpers", () => {
  it("treats idle and speech as silence origins; other is not", () => {
    expect(isSilenceOriginatedInterruption("idle")).toBe(true);
    expect(isSilenceOriginatedInterruption("speech")).toBe(true);
    expect(isSilenceOriginatedInterruption("other")).toBe(false);
  });

  it("detects forming thought from pending text or active transcription", () => {
    expect(isFormingThought({ hasPendingTranscription: true, isTranscriptionActive: false })).toBe(
      true,
    );
    expect(isFormingThought({ hasPendingTranscription: false, isTranscriptionActive: true })).toBe(
      true,
    );
    expect(isFormingThought({ hasPendingTranscription: false, isTranscriptionActive: false })).toBe(
      false,
    );
  });

  it("skips silence-origin interruptions while forming thought; allows empty idle and non-silence", () => {
    expect(
      shouldSkipSilenceInterruptionWhileFormingThought({
        origin: "idle",
        hasPendingTranscription: true,
        isTranscriptionActive: false,
      }),
    ).toBe(true);
    expect(
      shouldSkipSilenceInterruptionWhileFormingThought({
        origin: "speech",
        hasPendingTranscription: false,
        isTranscriptionActive: true,
      }),
    ).toBe(true);
    expect(
      shouldSkipSilenceInterruptionWhileFormingThought({
        origin: "idle",
        hasPendingTranscription: false,
        isTranscriptionActive: false,
      }),
    ).toBe(false);
    expect(
      shouldSkipSilenceInterruptionWhileFormingThought({
        origin: "other",
        hasPendingTranscription: true,
        isTranscriptionActive: false,
      }),
    ).toBe(false);
  });

  it("blocks idle PoW send while forming thought", () => {
    expect(
      shouldSendIdleProofOfWork({ hasPendingTranscription: true, isTranscriptionActive: false }),
    ).toBe(false);
    expect(
      shouldSendIdleProofOfWork({ hasPendingTranscription: false, isTranscriptionActive: true }),
    ).toBe(false);
    expect(
      shouldSendIdleProofOfWork({ hasPendingTranscription: false, isTranscriptionActive: false }),
    ).toBe(true);
  });
});

describe("createTapInterruptionScheduler forming-thought gate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not schedule idle interruptions while pending transcription is present", () => {
    const onIntervention = vi.fn();
    let forming = { hasPendingTranscription: true, isTranscriptionActive: false };
    const scheduler = createTapInterruptionScheduler(onIntervention, () => forming);

    scheduler.applyInterruption(sampleInterruption("idle_skip"), { origin: "idle" });
    vi.advanceTimersByTime(10_000);
    expect(onIntervention).not.toHaveBeenCalled();
  });

  it("still schedules non-silence interruptions with pending transcription", () => {
    const onIntervention = vi.fn();
    const scheduler = createTapInterruptionScheduler(onIntervention, () => ({
      hasPendingTranscription: true,
      isTranscriptionActive: false,
    }));

    scheduler.applyInterruption(sampleInterruption("chat_ok", 1_000), { origin: "other" });
    vi.advanceTimersByTime(1_000);
    expect(onIntervention).toHaveBeenCalledWith({
      interruptionId: "chat_ok",
      message: "Msg chat_ok",
    });
  });

  it("skips at fire time if learner starts forming thought during delay", () => {
    const onIntervention = vi.fn();
    let forming = { hasPendingTranscription: false, isTranscriptionActive: false };
    const scheduler = createTapInterruptionScheduler(onIntervention, () => forming);

    scheduler.applyInterruption(sampleInterruption("idle_late", 5_000), { origin: "idle" });
    forming = { hasPendingTranscription: true, isTranscriptionActive: false };
    vi.advanceTimersByTime(5_000);
    expect(onIntervention).not.toHaveBeenCalled();
  });

  it("fires idle interruption when bar empty and not speaking", () => {
    const onIntervention = vi.fn();
    const scheduler = createTapInterruptionScheduler(onIntervention, () => ({
      hasPendingTranscription: false,
      isTranscriptionActive: false,
    }));

    scheduler.applyInterruption(sampleInterruption("idle_fire", 2_000), { origin: "idle" });
    vi.advanceTimersByTime(2_000);
    expect(onIntervention).toHaveBeenCalledWith({
      interruptionId: "idle_fire",
      message: "Msg idle_fire",
    });
  });

  it("clearPendingSilenceInterruption only clears idle/speech timers", () => {
    const onIntervention = vi.fn();
    const scheduler = createTapInterruptionScheduler(onIntervention, () => ({
      hasPendingTranscription: false,
      isTranscriptionActive: false,
    }));

    scheduler.applyInterruption(sampleInterruption("chat_keep", 3_000), { origin: "other" });
    scheduler.clearPendingSilenceInterruption();
    vi.advanceTimersByTime(3_000);
    expect(onIntervention).toHaveBeenCalledWith({
      interruptionId: "chat_keep",
      message: "Msg chat_keep",
    });

    onIntervention.mockClear();
    scheduler.applyInterruption(sampleInterruption("idle_drop", 3_000), { origin: "idle" });
    scheduler.clearPendingSilenceInterruption();
    vi.advanceTimersByTime(3_000);
    expect(onIntervention).not.toHaveBeenCalled();
  });

  it("skipped idle while forming does not wipe a pending origin:other timer", () => {
    const onIntervention = vi.fn();
    let forming = { hasPendingTranscription: false, isTranscriptionActive: false };
    const scheduler = createTapInterruptionScheduler(onIntervention, () => forming);

    scheduler.applyInterruption(sampleInterruption("chat_pending", 5_000), { origin: "other" });
    forming = { hasPendingTranscription: true, isTranscriptionActive: false };
    // Idle recommendation arrives while learner is composing — must not clear chat timer.
    scheduler.applyInterruption(sampleInterruption("idle_noise", 1_000), { origin: "idle" });
    vi.advanceTimersByTime(5_000);
    expect(onIntervention).toHaveBeenCalledTimes(1);
    expect(onIntervention).toHaveBeenCalledWith({
      interruptionId: "chat_pending",
      message: "Msg chat_pending",
    });
  });
});

describe("TAP idle + interruption wiring (static)", () => {
  it("idle hook gates on pending transcription via shouldSendIdleProofOfWork", () => {
    const idle = fs.readFileSync(path.join(ROOT, "lib/useTapIdleProofOfWork.ts"), "utf8");
    expect(idle).toContain("shouldSendIdleProofOfWork");
    expect(idle).toContain("hasPendingTranscription");
  });

  it("TapScoreClient wires idle/speech origins and forming-thought getter", () => {
    const client = fs.readFileSync(path.join(ROOT, "components/TapScoreClient.tsx"), "utf8");
    expect(client).toContain("getFormingThought");
    expect(client).toContain('handlePowInterruption(interruption, "idle")');
    expect(client).toContain('handlePowInterruption(interruption, "speech")');
    expect(client).toContain("clearPendingSilenceInterruption");
  });

  it("ILE SessionView is not required to change for this TAP-only gate", () => {
    const ile = readSessionViewSurface();
    expect(ile).not.toContain("tap-interruption-gate");
    expect(ile).not.toContain("shouldSkipSilenceInterruptionWhileFormingThought");
  });
});
