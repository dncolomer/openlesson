"use client";

import type { ReactNode } from "react";
import { IleStartLoading } from "@/components/session-view/learn-start-loading";
import { SessionPageLoading } from "@/components/session-view/session-page-loading";
import { useSessionBranchSlot } from "@/components/session-view/session-policy-context";
import { useI18n } from "@/lib/i18n";
import { sessionCanvasMayOpen } from "@/lib/session-field-gate";

/** The tips plate while the action tree is built. The work canvas stays behind this until the tree is ready. */
export function SessionFieldLoader({
  status,
  error,
}: {
  status?: "idle" | "preparing" | "ready" | "failed" | null;
  error?: string | null;
}) {
  const { t } = useI18n();
  return (
    <SessionPageLoading
      data-session-field-gate=""
      data-session-field-open="false"
      data-session-field-status={status || "preparing"}
      className="h-full"
    >
      <IleStartLoading
        t={t}
        fieldStatus={status === "failed" ? "failed" : "preparing"}
        fieldError={error}
      />
    </SessionPageLoading>
  );
}

/** Children render only when the prepared tree is ready. A missing provider stays closed. */
export function SessionFieldGate({ children }: { children: ReactNode }) {
  const slot = useSessionBranchSlot();
  if (!sessionCanvasMayOpen(slot)) {
    return <SessionFieldLoader status={slot?.status} error={slot?.error} />;
  }
  return (
    <div data-session-field-gate data-session-field-open="true" className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {children}
    </div>
  );
}
