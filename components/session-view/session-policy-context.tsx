"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
import {
  graftSessionBranchModel,
  recommendSessionBranchAction,
  sessionBranchById,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import { requestSessionPolicyReply } from "@/lib/session-policy-infer-client";
import {
  parsePolicySuggestionReply,
  recordPolicyInference,
  SESSION_POLICY_INFER_EVENT_THRESHOLD,
  SESSION_POLICY_INFER_INTERVAL_MS,
  sessionPolicyCandidateLines,
  sessionPolicyInferDue,
  sessionPolicyProofFromCanvas,
  type SessionPolicyInference,
  type SessionPolicyProofEvent,
} from "@/lib/session-policy-infer";
import { sessionPolicySnapshot } from "@/lib/session-policy-score";
import type { SessionPolicyRecord } from "@/lib/session-policy-store";
import { SessionCommandBridgeProvider } from "@/components/session-view/session-command-bridge";
import type { SessionMarkMode, SessionMarkState } from "@/lib/session-marks";

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
const LIVE_THRESHOLDS = {
  eventCount: SESSION_POLICY_INFER_EVENT_THRESHOLD,
  elapsedMs: SESSION_POLICY_INFER_INTERVAL_MS,
};

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
const ProofPublishContext = createContext<
  ((events: readonly { toolAction?: unknown; metadata?: unknown }[]) => void) | null
>(null);
const PreparePublishContext = createContext<((body: Record<string, unknown> | null) => void) | null>(null);
const InferenceContext = createContext<readonly SessionPolicyInference[]>([]);
const SuggestionContext = createContext<string | null>(null);
const RestoreContext = createContext<((record: SessionPolicyRecord) => void) | null>(null);

export type SessionFieldReveal = {
  revealedIds: ReadonlySet<string> | null;
  currentIds: readonly string[];
  pass?: number;
  passes?: number;
};

const EMPTY_FIELD_REVEAL: SessionFieldReveal = { revealedIds: null, currentIds: [] };
const FieldRevealContext = createContext<SessionFieldReveal>(EMPTY_FIELD_REVEAL);
const FieldRevealPublishContext = createContext<((next: SessionFieldReveal | null) => void) | null>(
  null,
);
function publishRevealNowhere(_next: SessionFieldReveal | null) {}

function publishNowhere(_state: SessionMarkState) {}
function publishDraftNowhere(_draft: SessionMarkDraft | null) {}
function publishBranchNowhere(_slot: SetStateAction<SessionBranchSlot>) {}
function publishProofNowhere(_events: readonly { toolAction?: unknown; metadata?: unknown }[]) {}
function publishPrepareNowhere(_body: Record<string, unknown> | null) {}
function restoreNowhere(_record: SessionPolicyRecord) {}

function canvasNoteOf(events: readonly SessionPolicyProofEvent[]): string {
  return events
    .slice(-12)
    .map((event) => (event.prompt ? `${event.action}: ${event.prompt}` : event.action))
    .join("\n");
}

/** Shares the canvas mark draft and the prepared field with the live session. */
export function SessionPolicyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionMarkState | null>(null);
  const [draft, setDraft] = useState<SessionMarkDraft | null>(null);
  const [branchSlot, setBranchSlot] = useState<SessionBranchSlot>(IDLE_BRANCH_SLOT);
  const [canvasReady, setCanvasReady] = useState(false);
  const [inferences, setInferences] = useState<readonly SessionPolicyInference[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [fieldReveal, setFieldReveal] = useState<SessionFieldReveal>(EMPTY_FIELD_REVEAL);
  const [proofVersion, setProofVersion] = useState(0);
  const publishReveal = useCallback((next: SessionFieldReveal | null) => {
    setFieldReveal(next ?? EMPTY_FIELD_REVEAL);
  }, []);
  const canvasEffectRef = useRef<((effect: SessionMarkCanvasEffect) => void) | null>(null);
  const gateRef = useRef(emptyCanvasEffectGate());
  const slotRef = useRef<SessionBranchSlot>(IDLE_BRANCH_SLOT);
  const proofRef = useRef<SessionPolicyProofEvent[]>([]);
  const prepareRef = useRef<Record<string, unknown> | null>(null);
  const inferencesRef = useRef<readonly SessionPolicyInference[]>([]);
  const canvasBridge = useMemo<SessionMarkCanvasBridge>(
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
  const publishSlot = useCallback((action: SetStateAction<SessionBranchSlot>) => {
    const prev = slotRef.current;
    const next = typeof action === "function" ? action(prev) : action;
    slotRef.current = next;
    setBranchSlot(next);
    const chapterChanged = next.model?.chapterTitle !== prev.model?.chapterTitle;
    const rewound = Boolean(prev.model && prev.model.step > 0 && next.model && next.model.step === 0);
    if (!chapterChanged && !rewound) return;
    if (inferencesRef.current.length) {
      inferencesRef.current = [];
      setInferences([]);
    }
    setSuggestion(null);
  }, []);
  const publishProof = useCallback((events: readonly { toolAction?: unknown; metadata?: unknown }[]) => {
    const mapped = sessionPolicyProofFromCanvas(events);
    if (!mapped.length) return;
    const pending = proofRef.current.concat(mapped);
    proofRef.current = pending.length > 200 ? pending.slice(-200) : pending;
    setProofVersion((version) => version + 1);
  }, []);
  const publishPrepare = useCallback((body: Record<string, unknown> | null) => {
    prepareRef.current = body;
  }, []);
  const restorePolicy = useCallback((record: SessionPolicyRecord) => {
    const next: SessionBranchSlot = {
      status: "ready",
      model: record.model,
      birth: record.birth,
      error: null,
    };
    slotRef.current = next;
    setBranchSlot(next);
    inferencesRef.current = record.inferences;
    setInferences(record.inferences);
    setSuggestion(record.suggestion);
  }, []);
  return (
    <PublishContext.Provider value={setState}>
      <StateContext.Provider value={state}>
        <DraftPublishContext.Provider value={setDraft}>
          <DraftContext.Provider value={draft}>
            <CanvasEffectContext.Provider value={canvasBridge}>
              <CanvasReadyContext.Provider value={canvasReady}>
                <BranchPublishContext.Provider value={publishSlot}>
                  <BranchSlotContext.Provider value={branchSlot}>
                    <ProofPublishContext.Provider value={publishProof}>
                      <PreparePublishContext.Provider value={publishPrepare}>
                        <RestoreContext.Provider value={restorePolicy}>
                          <InferenceContext.Provider value={inferences}>
                            <SuggestionContext.Provider value={suggestion}>
                              <FieldRevealPublishContext.Provider value={publishReveal}>
                                <FieldRevealContext.Provider value={fieldReveal}>
                              <SessionPolicyInferLoop
                                proofRef={proofRef}
                                proofVersion={proofVersion}
                                prepareRef={prepareRef}
                                inferencesRef={inferencesRef}
                                setInferences={setInferences}
                                setSuggestion={setSuggestion}
                              />
                              <SessionCommandBridgeProvider>{children}</SessionCommandBridgeProvider>
                                </FieldRevealContext.Provider>
                              </FieldRevealPublishContext.Provider>
                            </SuggestionContext.Provider>
                          </InferenceContext.Provider>
                        </RestoreContext.Provider>
                      </PreparePublishContext.Provider>
                    </ProofPublishContext.Provider>
                  </BranchSlotContext.Provider>
                </BranchPublishContext.Provider>
              </CanvasReadyContext.Provider>
            </CanvasEffectContext.Provider>
          </DraftContext.Provider>
        </DraftPublishContext.Provider>
      </StateContext.Provider>
    </PublishContext.Provider>
  );
}

function SessionPolicyInferLoop({
  proofRef,
  proofVersion,
  prepareRef,
  inferencesRef,
  setInferences,
  setSuggestion,
}: {
  proofRef: MutableRefObject<SessionPolicyProofEvent[]>;
  proofVersion: number;
  prepareRef: MutableRefObject<Record<string, unknown> | null>;
  inferencesRef: MutableRefObject<readonly SessionPolicyInference[]>;
  setInferences: Dispatch<SetStateAction<readonly SessionPolicyInference[]>>;
  setSuggestion: Dispatch<SetStateAction<string | null>>;
}) {
  const slot = useSessionBranchSlot();
  const draft = useSessionMarkDraft();
  const publishSlot = usePublishSessionBranchSlot();
  const [clock, setClock] = useState(0);
  const inflight = useRef(false);
  const suggestInflight = useRef(false);
  const lastInferAt = useRef(Date.now());
  const lastSuggestAt = useRef(0);
  const suggestKey = useRef("");
  const suggestAction = useRef("");
  const latestWanted = useRef("");
  const chapterStamp = useRef<string | null>(null);
  const inferToken = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const id = window.setInterval(() => setClock((value) => value + 1), 1000);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const model = slot?.status === "ready" ? slot.model : null;
    if (model && chapterStamp.current !== model.chapterTitle) {
      const switched = chapterStamp.current != null;
      chapterStamp.current = model.chapterTitle;
      lastInferAt.current = Date.now();
      if (switched) {
        inferToken.current += 1;
        inflight.current = false;
        proofRef.current = [];
        suggestKey.current = "";
        latestWanted.current = "";
      }
    }
    if (inflight.current) return;
    if (!model) return;
    const pending = proofRef.current.length;
    if (
      !sessionPolicyInferDue({
        pendingEvents: pending,
        elapsedMs: Date.now() - lastInferAt.current,
        thresholds: LIVE_THRESHOLDS,
      })
    ) {
      return;
    }
    const prepare = prepareRef.current;
    if (!prepare) return;
    const batch = proofRef.current.slice();
    const token = inferToken.current;
    inflight.current = true;
    void requestSessionPolicyReply({
      ...prepare,
      phase: "infer",
      events: batch,
      candidates: sessionPolicyCandidateLines(model),
    }).then((reply) => {
      if (inferToken.current !== token) return;
      lastInferAt.current = Date.now();
      if (!reply) return;
      proofRef.current = proofRef.current.slice(batch.length);
      let recorded: readonly SessionPolicyInference[] | null = null;
      publishSlot((current) => {
        if (current.status !== "ready" || !current.model) return current;
        const next = recordPolicyInference(current.model, inferencesRef.current, reply);
        if (next.log === inferencesRef.current) return current;
        recorded = next.log;
        return {
          status: "ready",
          model: current.birth ? graftSessionBranchModel(next.model, current.birth) : next.model,
          birth: current.birth ?? current.model,
          error: null,
        };
      });
      if (recorded) {
        inferencesRef.current = recorded;
        setInferences(recorded);
      }
    }).finally(() => {
      if (inferToken.current === token) inflight.current = false;
      if (mounted.current) setClock((value) => value + 1);
    });
  }, [clock, inferencesRef, prepareRef, proofRef, proofVersion, publishSlot, setInferences, slot]);

  useEffect(() => {
    if (slot?.status !== "ready" || !slot.model) return;
    const model = slot.model;
    const recommended = recommendSessionBranchAction(model, model.focusId);
    if (!recommended) return;
    const focus = sessionBranchById(model, model.focusId);
    const canvasNote = [
      canvasNoteOf(proofRef.current),
      (draft?.selectedTexts ?? []).join("\n"),
      draft?.speech ?? "",
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join("\n");
    const key = `${model.focusId}:${model.step}:${recommended.id}:${canvasNote}`;
    if (suggestAction.current !== recommended.id) {
      if (suggestAction.current) setSuggestion(null);
      suggestAction.current = recommended.id;
    }
    latestWanted.current = key;
    if (suggestInflight.current) return;
    if (suggestKey.current === key) return;
    const sameStep = suggestKey.current.startsWith(`${model.focusId}:${model.step}:${recommended.id}:`);
    if (sameStep && Date.now() - lastSuggestAt.current < SESSION_POLICY_INFER_INTERVAL_MS) return;
    const prepare = prepareRef.current;
    if (!prepare) return;
    suggestInflight.current = true;
    suggestKey.current = key;
    lastSuggestAt.current = Date.now();
    void requestSessionPolicyReply({
      ...prepare,
      phase: "suggest",
      nodeTitle: recommended.leads || focus?.title || "",
      observation: recommended.observation || focus?.observation || "",
      intent: recommended.observation.trim() || recommended.leads.trim(),
      canvasNote,
    }).then((reply) => {
      if (latestWanted.current !== key) return;
      const text = reply ? parsePolicySuggestionReply(reply) : null;
      if (text) setSuggestion(text);
    }).finally(() => {
      suggestInflight.current = false;
      if (mounted.current) setClock((value) => value + 1);
    });
  }, [clock, draft, prepareRef, proofRef, proofVersion, setSuggestion, slot]);

  return null;
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

/** No-op outside the provider. Drawing and commands on every field flow land here. */
export function usePublishSessionProof(): (
  events: readonly { toolAction?: unknown; metadata?: unknown }[],
) => void {
  return useContext(ProofPublishContext) ?? publishProofNowhere;
}

export function usePublishSessionPrepareRequest(): (body: Record<string, unknown> | null) => void {
  return useContext(PreparePublishContext) ?? publishPrepareNowhere;
}

export function useSessionPolicyInferences(): readonly SessionPolicyInference[] {
  return useContext(InferenceContext);
}

export function useSessionPolicySuggestion(): string | null {
  return useContext(SuggestionContext);
}

export function useSessionFieldReveal(): SessionFieldReveal {
  return useContext(FieldRevealContext);
}

export function usePublishSessionFieldReveal(): (next: SessionFieldReveal | null) => void {
  return useContext(FieldRevealPublishContext) ?? publishRevealNowhere;
}

/** Puts a stored snapshot on the field without treating it as a new chapter. */
export function useRestoreSessionPolicy(): (record: SessionPolicyRecord) => void {
  return useContext(RestoreContext) ?? restoreNowhere;
}

export type SessionPolicySnapshot = {
  model: SessionBranchModel | null;
  sequence: string[];
};

export function emptySessionPolicySnapshot(): SessionPolicySnapshot {
  return { model: null, sequence: [] };
}

/** Copies the prepared tree and the inferred path into a ref the end path can read. */
export function SessionPolicyBridge({ target }: { target: MutableRefObject<SessionPolicySnapshot> }) {
  const slot = useSessionBranchSlot();
  const inferences = useSessionPolicyInferences();
  const preparedRef = useRef<SessionBranchModel | null>(null);
  const next = sessionPolicySnapshot(
    preparedRef.current,
    slot,
    inferences.map((entry) => ({ hiddenStateId: entry.hiddenStateId })),
  );
  preparedRef.current = next.prepared;
  target.current = next.snapshot;
  return null;
}
