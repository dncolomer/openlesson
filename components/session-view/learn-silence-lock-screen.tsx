"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
import { useI18n } from "@/lib/i18n";

/** Paint above the session. A fixed layer inside the flex stage gets clipped. */
export function mountIleSilenceScreen(node: ReactNode): ReactNode {
  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

/** TAP-parity Session Invalidated overlay. Try again reloads the Learn session. */
export function IleSessionImpureScreen({ onTryAgain }: { onTryAgain: () => void }) {
  const { t } = useI18n();
  return (
    <SessionFinishedScreen
      overlay
      data-ile-session-impure=""
      data-tap-session-impure=""
      frameLabel={null}
      title={t("tap.postSession.impureTitle")}
      body={t("tap.postSession.impureBody")}
      actions={
        <button
          type="button"
          data-ile-impure-retry=""
          data-tap-impure-retry=""
          onClick={onTryAgain}
          className="inline-flex items-center justify-center bg-white px-4 py-3 text-sm font-semibold text-neutral-950"
        >
          {t("tap.postSession.impureTryAgain")}
        </button>
      }
    />
  );
}
