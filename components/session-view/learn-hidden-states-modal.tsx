"use client";

import { useMemo } from "react";
import {
  useSessionBranchSlot,
  useSessionPolicyInferences,
} from "@/components/session-view/session-policy-context";
import { WorkspaceUnsysSeedGraph } from "@/components/WorkspaceUnsysSeedGraph";
import { DialogFrame } from "@/components/ui/DialogFrame";
import {
  LEARN_HIDDEN_STATES_BUTTON_LABEL,
  LEARN_HIDDEN_STATES_MODAL_TITLE,
  LEARN_HIDDEN_STATES_SUGGESTION_LABEL,
} from "@/lib/session-harness";
import {
  learnVisitedHiddenStateIds,
  sessionBranchPathFromRoot,
} from "@/lib/session-branch-field-layout";
import {
  sessionBranchCheapestTransition,
  type SessionBranchModel,
} from "@/lib/session-branch-model";

export function LearnHiddenStatesTree({
  model,
  inferences,
}: {
  model: SessionBranchModel;
  inferences: readonly { hiddenStateId?: string | null; fromId?: string | null }[];
}) {
  const loadedIds = useMemo(
    () => new Set(sessionBranchPathFromRoot(model, model.focusId)),
    [model],
  );
  const visitedIds = useMemo(
    () => learnVisitedHiddenStateIds(model, inferences),
    [inferences, model],
  );
  const transition = useMemo(
    () => sessionBranchCheapestTransition(model, model.focusId),
    [model],
  );
  return (
    <>
      {transition ? (
        <p
          data-learn-hidden-states-transition=""
          className="font-mono text-[13px] leading-snug text-white"
        >
          <span className="pr-2 uppercase tracking-[0.16em] text-white/45">
            {LEARN_HIDDEN_STATES_SUGGESTION_LABEL}
          </span>
          <span data-learn-hidden-states-transition-to={transition.toId}>
            {transition.toTitle}
          </span>
        </p>
      ) : null}
      <div
        data-learn-hidden-states-map=""
        className="relative h-[min(82vh,42rem)] w-full overflow-hidden border border-white/25 bg-[#050505]"
      >
        <WorkspaceUnsysSeedGraph
          model={model}
          focusId={model.focusId}
          pulseHere
          visitedIds={visitedIds}
          loadedIds={loadedIds}
        />
      </div>
    </>
  );
}

export function LearnHiddenStatesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const slot = useSessionBranchSlot();
  const inferences = useSessionPolicyInferences();
  const model = slot?.model ?? null;
  return (
    <DialogFrame
      open={open}
      onClose={onClose}
      size="xl"
      headerClose
      labelledBy="learn-hidden-states-title"
      testId="learn-hidden-states"
      panelClassName="max-h-[min(94vh,52rem)]"
    >
      <div className="flex flex-col gap-2 px-3 pb-3 pt-7">
        <h2
          id="learn-hidden-states-title"
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70"
        >
          {LEARN_HIDDEN_STATES_MODAL_TITLE}
        </h2>
        {!model || slot?.status === "preparing" ? (
          <p
            data-learn-hidden-states-empty=""
            className="font-mono text-[12px] leading-snug text-white/70"
          >
            {slot?.status === "preparing"
              ? "Preparing the field for this session."
              : slot?.error || "The hidden-state tree is not loaded yet."}
          </p>
        ) : (
          <LearnHiddenStatesTree model={model} inferences={inferences} />
        )}
      </div>
    </DialogFrame>
  );
}

export function LearnHiddenStatesButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-session-harness-hidden-states=""
      onClick={onClick}
      className="w-full border border-white/40 bg-black px-2 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-white hover:border-white hover:bg-neutral-950"
    >
      {LEARN_HIDDEN_STATES_BUTTON_LABEL}
    </button>
  );
}
