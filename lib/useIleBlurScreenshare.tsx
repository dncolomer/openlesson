"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { IleCompactStashWindow } from "@/components/IleCompactStashWindow";
import { I18nProvider } from "@/lib/i18n";
import {
  decideIleMiniAutoOpen,
  isIleAwayFromTab,
  readIleTabFocusedFromDocument,
  shouldHonorIleMiniHide,
  type IleLeaveFocusReason,
} from "@/lib/ile-blur-screenshare";
import {
  attachIleAutoPipCaptureElement,
  clearIleEnterPictureInPictureHandler,
  decideIlePipStayVsHide,
  detachIleAutoPipCaptureElement,
  interpretIlePipPagehide,
  markIleMediaSessionCaptureActive,
  openIleDocumentPictureInPictureWindow,
  registerIleEnterPictureInPictureHandler,
  resolveIleMediaSession,
  shouldDestroyIlePipOnHide,
  shouldRequestIleDocumentPipAfterDismiss,
  shouldRequestIleDocumentPipOnLeave,
  shouldUseIleDocumentPipOnly,
} from "@/lib/ile-auto-pip";
import {
  closeIleAlwaysOnTopWindow,
  decideIleMiniWindowKind,
  isIleCompactWindowLive,
  openIleCompactPopupWindow,
  shouldAutoOpenIleMiniOnLeave,
  shouldKeepIleManualPopupOnReturn,
  shouldShowIleOpenPicInPicButton,
  type IleCompactWindowHandle,
} from "@/lib/ile-compact-window";

export type IleBlurScreenshareCompactProps = {
  formingText?: string | null;
  speechDisplay?: string | null;
  speechError?: string | null;
  speechSupported?: boolean | null;
  isListening?: boolean;
  speechEnabled?: boolean;
  isScreenSharing?: boolean;
};

export function useIleBlurScreenshare(input: {
  enabled: boolean;
  isScreenSharing: boolean;
  startScreenshare: () => Promise<boolean | void>;
  /** Existing I'm Done Answering close path (session tab). */
  onDoneAnswering?: () => void | Promise<void>;
  /** Live getUserMedia stream so Chrome treats the tab as conferencing-eligible. */
  captureStream?: MediaStream | null;
  compact: IleBlurScreenshareCompactProps;
  /** Chapter widget clone painted inside the PiP / popup document. */
  renderCompact?: () => ReactNode;
}): {
  notifyLeaveTab: (reason: IleLeaveFocusReason) => void;
  openManualPicInPic: () => void;
  showManualPicInPic: boolean;
} {
  const compactRef = useRef<IleCompactWindowHandle | null>(null);
  const compactRootRef = useRef<Root | null>(null);
  const compactPropsRef = useRef(input.compact);
  compactPropsRef.current = input.compact;
  const renderCompactRef = useRef(input.renderCompact);
  renderCompactRef.current = input.renderCompact;

  const enabledRef = useRef(input.enabled);
  enabledRef.current = input.enabled;
  const sharingRef = useRef(input.isScreenSharing);
  sharingRef.current = input.isScreenSharing;
  const startRef = useRef(input.startScreenshare);
  startRef.current = input.startScreenshare;
  const doneAnsweringRef = useRef(input.onDoneAnswering);
  doneAnsweringRef.current = input.onDoneAnswering;
  const justOpenedRef = useRef(false);
  const justOpenedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userDismissedRef = useRef(false);

  const paintCompact = useCallback((win: Window) => {
    if (!compactRootRef.current) {
      compactRootRef.current = createRoot(win.document.body);
    }
    const compact = compactPropsRef.current;
    compactRootRef.current.render(
      <I18nProvider>
        <IleCompactStashWindow
          isScreenSharing={compact.isScreenSharing}
          onStartShare={() => startRef.current()}
        >
          {renderCompactRef.current?.() ?? null}
        </IleCompactStashWindow>
      </I18nProvider>,
    );
  }, []);

  const hideCompact = useCallback((opts?: { destroy?: boolean }) => {
    if (
      opts?.destroy !== true &&
      shouldKeepIleManualPopupOnReturn({
        kind: compactRef.current?.kind,
        sessionActive: enabledRef.current,
      })
    ) {
      return;
    }
    try {
      compactRootRef.current?.unmount();
    } catch {
      /* already gone */
    }
    compactRootRef.current = null;
    const destroy =
      opts?.destroy === true ||
      shouldDestroyIlePipOnHide({
        sessionActive: enabledRef.current,
        reason: enabledRef.current ? "return" : "session_off",
        kind: compactRef.current?.kind,
      });
    if (destroy) closeIleAlwaysOnTopWindow(compactRef.current);
    compactRef.current = null;
  }, []);

  const markJustOpened = useCallback(() => {
    justOpenedRef.current = true;
    if (justOpenedTimerRef.current) clearTimeout(justOpenedTimerRef.current);
    justOpenedTimerRef.current = setTimeout(() => {
      justOpenedRef.current = false;
      justOpenedTimerRef.current = null;
    }, 1200);
  }, []);

  const adoptOpenedCompact = useCallback(
    (handle: IleCompactWindowHandle) => {
      compactRef.current = handle;
      markJustOpened();
      handle.window.addEventListener("pagehide", () => {
        const openerHidden = typeof document !== "undefined" ? document.hidden : undefined;
        const verdict = interpretIlePipPagehide({
          openerHidden,
          windowClosed: handle.window.closed,
          justOpened: justOpenedRef.current,
        });
        if (verdict === "ignore") return;
        userDismissedRef.current = true;
        try {
          compactRootRef.current?.unmount();
        } catch {
          /* already gone */
        }
        compactRootRef.current = null;
        if (compactRef.current === handle) compactRef.current = null;
      });
      paintCompact(handle.window);
    },
    [hideCompact, markJustOpened, paintCompact],
  );

  const applyDecision = useCallback(async (leaveReason: IleLeaveFocusReason | null, tabFocused: boolean) => {
    if (!enabledRef.current) {
      hideCompact();
      return;
    }

    const liveFocused = readIleTabFocusedFromDocument();
    const openerHidden = typeof document !== "undefined" ? document.hidden : undefined;
    const pipOnly = shouldUseIleDocumentPipOnly();
    if (!shouldAutoOpenIleMiniOnLeave({ documentPipSupported: pipOnly })) {
      if (isIleCompactWindowLive(compactRef.current) && !userDismissedRef.current) {
        paintCompact(compactRef.current!.window);
      }
      return;
    }
    const auto = decideIleMiniAutoOpen({
      sessionActive: enabledRef.current,
      tabFocused: liveFocused,
      leaveReason,
      documentPipSupported: pipOnly,
    });

    const away = isIleAwayFromTab({ tabFocused: liveFocused, leaveReason });
    if (shouldHonorIleMiniHide({ decision: auto, away })) {
      hideCompact();
      return;
    }

    const stayEvent =
      leaveReason != null
        ? "leave"
        : tabFocused
          ? "opener_focus"
          : "opener_blur";
    const stay = decideIlePipStayVsHide({
      sessionActive: enabledRef.current,
      event: stayEvent,
      openerHidden,
      openerHasFocus: liveFocused,
      leaveReason,
      justOpened: justOpenedRef.current,
      kind: compactRef.current?.kind,
    });

    if (stay === "hide") {
      hideCompact();
      return;
    }

    if (isIleCompactWindowLive(compactRef.current) && !userDismissedRef.current) {
      paintCompact(compactRef.current!.window);
      return;
    }

    const windowKind = decideIleMiniWindowKind(pipOnly);
    let handle: IleCompactWindowHandle | null = null;
    if (windowKind === "document-pip") {
      const shouldOpenPip =
        shouldRequestIleDocumentPipOnLeave({
          sessionActive: enabledRef.current,
          compactWindow: "show",
          documentPipSupported: true,
        }) ||
        shouldRequestIleDocumentPipAfterDismiss({
          sessionActive: enabledRef.current,
          away: true,
          reusable: false,
          documentPipSupported: true,
        });
      if (shouldOpenPip) {
        handle = await openIleDocumentPictureInPictureWindow({
          userDismissed: userDismissedRef.current,
        });
      }
    }
    if (!handle) return;
    userDismissedRef.current = false;
    if (
      decideIlePipStayVsHide({
        sessionActive: enabledRef.current,
        event: "open_complete",
        openerHidden: typeof document !== "undefined" ? document.hidden : undefined,
        openerHasFocus: readIleTabFocusedFromDocument(),
        justOpened: true,
      }) === "hide"
    ) {
      closeIleAlwaysOnTopWindow(handle);
      return;
    }
    adoptOpenedCompact(handle);
  }, [adoptOpenedCompact, hideCompact, paintCompact]);

  const openCompactFromGesture = useCallback(async () => {
    if (isIleCompactWindowLive(compactRef.current) && !userDismissedRef.current) {
      paintCompact(compactRef.current!.window);
      return;
    }
    const handle = shouldUseIleDocumentPipOnly()
      ? await openIleDocumentPictureInPictureWindow({
          userDismissed: userDismissedRef.current,
        })
      : await openIleCompactPopupWindow();
    if (!handle) return;
    userDismissedRef.current = false;
    adoptOpenedCompact(handle);
  }, [adoptOpenedCompact, hideCompact, paintCompact]);

  const notifyLeaveTab = useCallback(
    (reason: IleLeaveFocusReason) => {
      void applyDecision(reason, false);
    },
    [applyDecision],
  );

  useEffect(() => {
    if (!input.enabled) {
      const session = resolveIleMediaSession();
      clearIleEnterPictureInPictureHandler(session);
      markIleMediaSessionCaptureActive(session, false);
      hideCompact();
      return;
    }

    const session = resolveIleMediaSession();
    const captureEl = attachIleAutoPipCaptureElement(input.captureStream);
    registerIleEnterPictureInPictureHandler(session, async () => {
      if (!enabledRef.current) return;
      if (isIleCompactWindowLive(compactRef.current) && !userDismissedRef.current) {
        paintCompact(compactRef.current!.window);
        return;
      }
      const handle = await openIleDocumentPictureInPictureWindow({
        userDismissed: userDismissedRef.current,
      });
      if (!handle) return;
      userDismissedRef.current = false;
      adoptOpenedCompact(handle);
    });
    markIleMediaSessionCaptureActive(session, true);

    const onVisibility = () => {
      const focused = !document.hidden && document.hasFocus();
      void applyDecision(document.hidden ? "tab_hidden" : null, focused);
    };
    const onBlur = () => {
      void applyDecision("tab_blur", false);
    };
    const onFocus = () => {
      void applyDecision(null, true);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      clearIleEnterPictureInPictureHandler(session);
      markIleMediaSessionCaptureActive(session, false);
      detachIleAutoPipCaptureElement(captureEl);
    };
  }, [input.enabled, input.captureStream, adoptOpenedCompact, applyDecision, hideCompact, paintCompact]);

  useEffect(() => {
    if (!input.enabled) {
      hideCompact();
    }
  }, [input.enabled, hideCompact]);

  useEffect(() => {
    const handle = compactRef.current;
    if (!handle || handle.window.closed) return;
    paintCompact(handle.window);
  }, [input.compact, input.renderCompact, paintCompact]);

  useEffect(() => () => hideCompact({ destroy: true }), [hideCompact]);

  const showManualPicInPic = shouldShowIleOpenPicInPicButton(shouldUseIleDocumentPipOnly());

  return {
    notifyLeaveTab,
    openManualPicInPic: openCompactFromGesture,
    showManualPicInPic,
  };
}
