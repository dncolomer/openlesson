/**
 * Sidebar presses reach the board only after the canvas has registered an effect.
 * Until then they wait, and the actions stay closed.
 */

import type { SessionMarkCanvasEffect } from "@/lib/session-mark-canvas";

export type CanvasEffectGateState = {
  handlerReady: boolean;
  queued: SessionMarkCanvasEffect[];
};

export function emptyCanvasEffectGate(): CanvasEffectGateState {
  return { handlerReady: false, queued: [] };
}

/** A press before the canvas is listening waits. A press after it is delivered now. */
export function canvasEffectGateApply(
  state: CanvasEffectGateState,
  effect: SessionMarkCanvasEffect,
): { state: CanvasEffectGateState; deliver: boolean } {
  if (state.handlerReady) return { state, deliver: true };
  return {
    state: { handlerReady: false, queued: [...state.queued, effect] },
    deliver: false,
  };
}

/** Registering the live canvas flushes what waited. Unregistering keeps that queue. */
export function canvasEffectGateRegister(
  state: CanvasEffectGateState,
  present: boolean,
): { state: CanvasEffectGateState; flush: SessionMarkCanvasEffect[] } {
  if (!present) return { state: { handlerReady: false, queued: state.queued }, flush: [] };
  return { state: { handlerReady: true, queued: [] }, flush: state.queued };
}

/**
 * Inside the session provider the four actions wait for the canvas effect.
 * A direct canvas callback, or a control rendered outside that provider, still commits.
 */
export function sessionActionsMayCommit(input: {
  bridge: boolean;
  ready: boolean;
  direct: boolean;
}): boolean {
  if (input.direct || !input.bridge) return true;
  return input.ready;
}
