import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ProofOfWorkApiInterruption } from "@/lib/agent-v2/predictive-interruption";

/** Mirrors scheduling semantics from useTapPredictiveInterruption for unit testing. */
function createInterruptionScheduler(onIntervention: (payload: { interruptionId: string; message: string }) => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingId: string | null = null;

  const clearPending = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pendingId = null;
  };

  const applyInterruption = (interruption: ProofOfWorkApiInterruption) => {
    clearPending();
    if (!interruption) return;
    const interruptionId = interruption.interruption_id;
    pendingId = interruptionId;
    timer = setTimeout(() => {
      if (pendingId !== interruptionId) return;
      onIntervention({ interruptionId, message: interruption.intervention.message });
      pendingId = null;
      timer = null;
    }, interruption.delay_ms);
  };

  return { applyInterruption, clearPending };
}

describe("tap interruption scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules intervention after delay_ms", () => {
    const onIntervention = vi.fn();
    const scheduler = createInterruptionScheduler(onIntervention);

    scheduler.applyInterruption({
      interruption_id: "int_test_1",
      delay_ms: 5_000,
      intervention: { type: "reflection_prompt", message: "Pause and reflect." },
      confidence: "medium",
      predicted_at: new Date().toISOString(),
    });

    vi.advanceTimersByTime(4_999);
    expect(onIntervention).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onIntervention).toHaveBeenCalledWith({
      interruptionId: "int_test_1",
      message: "Pause and reflect.",
    });
  });

  it("supersedes pending timer when a newer interruption arrives", () => {
    const onIntervention = vi.fn();
    const scheduler = createInterruptionScheduler(onIntervention);

    scheduler.applyInterruption({
      interruption_id: "int_old",
      delay_ms: 10_000,
      intervention: { type: "reflection_prompt", message: "Old" },
      confidence: "low",
      predicted_at: new Date().toISOString(),
    });
    scheduler.applyInterruption({
      interruption_id: "int_new",
      delay_ms: 3_000,
      intervention: { type: "checkpoint_probe", message: "New" },
      confidence: "high",
      predicted_at: new Date().toISOString(),
    });

    vi.advanceTimersByTime(10_000);

    expect(onIntervention).toHaveBeenCalledTimes(1);
    expect(onIntervention).toHaveBeenCalledWith({
      interruptionId: "int_new",
      message: "New",
    });
  });

  it("clears pending timer when interruption is null", () => {
    const onIntervention = vi.fn();
    const scheduler = createInterruptionScheduler(onIntervention);

    scheduler.applyInterruption({
      interruption_id: "int_clear",
      delay_ms: 8_000,
      intervention: { type: "coaching_nudge", message: "Nudge" },
      confidence: "medium",
      predicted_at: new Date().toISOString(),
    });
    scheduler.applyInterruption(null);

    vi.advanceTimersByTime(8_000);
    expect(onIntervention).not.toHaveBeenCalled();
  });
});