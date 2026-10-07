"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  canvasEffectGateApply,
  canvasEffectGateRegister,
  emptyCanvasEffectGate,
} from "@/lib/session-canvas-effect-gate";
import type { SessionMarkCanvasEffect } from "@/lib/session-mark-canvas";
import type { SessionBranchModel } from "@/lib/session-branch-model";
import { sessionPolicySnapshot } from "@/lib/session-policy-score";
import type { SessionMarkButtonId, SessionMarkMode, SessionMarkState } from "@/lib/session-marks";

const PublishContext = createContext<((state: SessionMarkState) => void) | null>(null);
const StateContext = createContext<SessionMarkState | null>(null);

export type SessionMarkDraft = {
  mode: SessionMarkMode;
  questions: readonly { id?: string | null; text?: string | null }[];
  /** Session and chapter. A change replaces the frozen list. Growth inside it does not. */
  listKey?: string | null;
  selectionActive: boolean;
  selectedTexts: readonly string[];
  speech: string;
};

export type SessionBranchSlot = {
  status: "idle" | "preparing" | "ready" | "failed";
  model: SessionBranchModel | null;
  /** Birth tree. It grows while the rest of the field is still being written. */
  birth?: SessionBranchModel | null;
  error: string | null;
};

const IDLE_BRANCH_SLOT: SessionBranchSlot = { status: "idle", model: null, error: null };

const DraftPublishContext = createContext<((draft: SessionMarkDraft | null) => void) | null>(null);
const DraftContext = createContext<SessionMarkDraft | null>(null);

type SessionMarkCanvasBridge = {
  apply: (effect: SessionMarkCanvasEffect) => void;
  register: (fn: ((effect: SessionMarkCanvasEffect) => void) | null) => void;
};

const CanvasEffectContext = createContext<SessionMarkCanvasBridge | null>(null);
const CanvasReadyContext = createContext(false);
const BranchSlotContext = createContext<SessionBranchSlot | null>(null);
const BranchPublishContext = createContext<Dispatch<SetStateAction<SessionBranchSlot>> | null>(null);

function publishNowhere(_state: SessionMarkState) {}
function publishDraftNowhere(_draft: SessionMarkDraft | null) {}
function publishBranchNowhere(_slot: SetStateAction<SessionBranchSlot>) {}

/** Learn chrome shares the canvas button state with the sidebar policy tab. */
export function SessionPolicyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionMarkState | null>(null);
  const [draft, setDraft] = useState<SessionMarkDraft | null>(null);
  const [branchSlot, setBranchSlot] = useState<SessionBranchSlot>(IDLE_BRANCH_SLOT);
  const [canvasReady, setCanvasReady] = useState(false);
  const canvasEffectRef = useRef<((effect: SessionMarkCanvasEffect) => void) | null>(null);
  const gateRef = useRef(emptyCanvasEffectGate());
  const canvasEffects = useMemo<SessionMarkCanvasBridge>(
    () => ({
      apply(effect) {
        const decision = canvasEffectGateApply(gateRef.current, effect);
        gateRef.current = decision.state;
        if (decision.deliver) canvasEffectRef.current?.(effect);
      },
      register(fn) {
        canvasEffectRef.current = fn;
        const decision = canvasEffectGateRegister(gateRef.current, fn != null);
        gateRef.current = decision.state;
        if (fn) {
          for (const effect of decision.flush) fn(effect);
        }
        setCanvasReady(decision.state.handlerReady);
      },
    }),
    [],
  );
  return (
    <PublishContext.Provider value={setState}>
      <StateContext.Provider value={state}>
        <DraftPublishContext.Provider value={setDraft}>
          <DraftContext.Provider value={draft}>
            <CanvasEffectContext.Provider value={canvasEffects}>
              <CanvasReadyContext.Provider value={canvasReady}>
                <BranchPublishContext.Provider value={setBranchSlot}>
                  <BranchSlotContext.Provider value={branchSlot}>{children}</BranchSlotContext.Provider>
                </BranchPublishContext.Provider>
              </CanvasReadyContext.Provider>
            </CanvasEffectContext.Provider>
          </DraftContext.Provider>
        </DraftPublishContext.Provider>
      </StateContext.Provider>
    </PublishContext.Provider>
  );
}

export function usePublishSessionPolicy(): (state: SessionMarkState) => void {
  return useContext(PublishContext) ?? publishNowhere;
}

export function useSessionPolicyState(): SessionMarkState | null {
  return useContext(StateContext);
}

export function usePublishSessionMarkDraft(): (draft: SessionMarkDraft | null) => void {
  return useContext(DraftPublishContext) ?? publishDraftNowhere;
}

export function useSessionMarkDraft(): SessionMarkDraft | null {
  return useContext(DraftContext);
}

/** The canvas registers the Keep / Discard scene edit. The sidebar calls apply. */
export function useSessionMarkCanvasEffects(): SessionMarkCanvasBridge | null {
  return useContext(CanvasEffectContext);
}

/** False until the work canvas has registered an effect that can place an observation. */
export function useSessionCanvasEffectReady(): boolean {
  return useContext(CanvasReadyContext);
}

/** Null outside the provider. Idle renders nothing in the policy tab. */
export function useSessionBranchSlot(): SessionBranchSlot | null {
  return useContext(BranchSlotContext);
}

export function usePublishSessionBranchSlot(): Dispatch<SetStateAction<SessionBranchSlot>> {
  return useContext(BranchPublishContext) ?? publishBranchNowhere;
}

export type SessionPolicySnapshot = {
  model: SessionBranchModel | null;
  sequence: SessionMarkButtonId[];
};

export function emptySessionPolicySnapshot(): SessionPolicySnapshot {
  return { model: null, sequence: [] };
}

/** Copies the prepared tree and the button path into a ref the end path can read. */
export function SessionPolicyBridge({ target }: { target: MutableRefObject<SessionPolicySnapshot> }) {
  const slot = useSessionBranchSlot();
  const state = useSessionPolicyState();
  const preparedRef = useRef<SessionBranchModel | null>(null);
  const next = sessionPolicySnapshot(preparedRef.current, slot, state?.presses);
  preparedRef.current = next.prepared;
  target.current = next.snapshot;
  return null;
}
