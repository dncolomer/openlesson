"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { SessionFieldGate } from "@/components/session-view/session-field-gate";
import {
  SessionPolicyProvider,
  usePublishSessionBranchSlot,
  usePublishSessionPrepareRequest,
  useRestoreSessionPolicy,
} from "@/components/session-view/session-policy-context";
import {
  learnFieldFromStoredPolicy,
  readSessionPolicyRecord,
} from "@/lib/session-policy-store";
import { adoptSessionBranchGrowth } from "@/lib/session-branch-model";
import {
  loadSessionBranchField,
  readSessionBranchFieldCache,
  sessionBranchFieldRequestKey,
  subscribeSessionBranchField,
} from "@/lib/session-branch-field-load";
import {
  planSessionBranchPrepare,
  sessionBranchPrepareRequest,
  type SessionBranchPrepareInput,
} from "@/lib/session-branch-prepare";

/** Prepare the field once per session slice. A stored policy for this chapter is restored instead. */
export function useSessionBranchField(
  input: SessionBranchPrepareInput,
  storedMetadata?: unknown,
): void {
  const publish = usePublishSessionBranchSlot();
  const publishPrepare = usePublishSessionPrepareRequest();
  const restore = useRestoreSessionPolicy();
  const inputRef = useRef(input);
  inputRef.current = input;
  const storedRef = useRef(storedMetadata);
  storedRef.current = storedMetadata;
  const requestKey = sessionBranchFieldRequestKey(input) ?? "null";
  useLayoutEffect(() => {
    publishPrepare(
      requestKey === "null"
        ? null
        : sessionBranchPrepareRequest(planSessionBranchPrepare(inputRef.current)),
    );
    if (requestKey === "null") return;
    const storedField = learnFieldFromStoredPolicy(storedRef.current, inputRef.current);
    const record = storedField ? readSessionPolicyRecord(storedRef.current) : null;
    if (record) {
      restore(record);
      return;
    }
    const applyReady = (model: NonNullable<ReturnType<typeof readSessionBranchFieldCache>>["model"], birth: NonNullable<ReturnType<typeof readSessionBranchFieldCache>>["birth"]) => {
      if (!model) return;
      publish((current) => adoptSessionBranchGrowth(current, model, birth ?? model));
    };
    const cached = readSessionBranchFieldCache(requestKey);
    const unsubscribe = subscribeSessionBranchField(requestKey, (entry) => {
      if (entry.status === "ready") applyReady(entry.model, entry.birth);
    });
    if (cached?.status === "ready" && cached.model) {
      applyReady(cached.model, cached.birth);
      return unsubscribe;
    }
    const controller = new AbortController();
    publish((current) =>
      current.status === "ready" && current.model
        ? current
        : { status: "preparing", model: null, birth: null, error: null },
    );
    void loadSessionBranchField(inputRef.current, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (!result.ok) {
        publish((current) =>
          current.status === "ready" && current.model
            ? current
            : { status: "failed", model: null, birth: null, error: result.error },
        );
        return;
      }
      const fresh = readSessionBranchFieldCache(requestKey);
      applyReady(fresh?.model ?? result.model, fresh?.birth ?? result.model);
    });
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [publish, publishPrepare, restore, requestKey]);
}

export function SessionBranchFieldPrepare({
  input,
  children,
}: {
  input: SessionBranchPrepareInput;
  children: ReactNode;
}) {
  useSessionBranchField(input);
  return <SessionFieldGate>{children}</SessionFieldGate>;
}

/** Public and workspace live surfaces sit outside Learn chrome, so they carry their own provider. */
export function SessionBranchFieldBoundary({
  enabled,
  input,
  children,
}: {
  enabled: boolean;
  input: SessionBranchPrepareInput;
  children: ReactNode;
}) {
  if (!enabled) return children;
  return (
    <SessionPolicyProvider>
      <SessionBranchFieldPrepare input={input}>{children}</SessionBranchFieldPrepare>
    </SessionPolicyProvider>
  );
}
