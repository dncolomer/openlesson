"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { IleCompactStashWindow } from "@/components/IleCompactStashWindow";
import {
  decideIleMiniModeFirstAsk,
  isIleAwayFromTab,
  loadIleMiniModeConsent,
  readIleTabFocusedFromDocument,
  runIleLeaveFocusSequence,
  saveIleMiniModeConsent,
  shouldHonorIleMiniModeHide,
  type IleLeaveFocusReason,
  type IleMiniModeConsent,
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
  isIlePopupReusable,
  openIleCompactPopupWindow,
  shouldAutoOpenIleMiniOnLeave,
  shouldKeepIleManualPopupOnReturn,
  shouldOpenIlePopupFromButton,
  shouldReaskIleMiniModeForPopup,
  shouldRequestIlePopupOnLeave,
  shouldShowIleOpenPicInPicButton,
  type IleCompactWindowHandle,
} from "@/lib/ile-compact-window";

export type IleBlurScreenshareCompactProps = {
  chapterLabel?: string | null;
  formingText?: string | null;
  transcriptText?: string | null;
  isSending?: boolean;
  heliosTurnMode?: string | null;
  isScreenSharing?: boolean;
};

export function useIleBlurScreenshare(input: {
  enabled: boolean;
  isScreenSharing: boolean;
  startScreenshare: () => Promise<boolean | void>;
  /** Live getUserMedia stream so Chrome treats the tab as conferencing-eligible. */
  captureStream?: MediaStream | null;
  compact: IleBlurScreenshareCompactProps;
}): {
  notifyLeaveTab: (reason: IleLeaveFocusReason) => void;
  miniFirstAskVisible: boolean;
  acceptMiniMode: () => void;
  declineMiniMode: () => void;
  openManualPicInPic: () => void;
  showManualPicInPic: boolean;
} {
  const shareInFlightRef = useRef(false);
  const shareDeclinedRef = useRef(false);
  const consentRef = useRef<IleMiniModeConsent>(loadIleMiniModeConsent());
  const [miniFirstAskVisible, setMiniFirstAskVisible] = useState(false);
  const compactRef = useRef<IleCompactWindowHandle | null>(null);
  const compactRootRef = useRef<Root | null>(null);
  const compactPropsRef = useRef(input.compact);
  compactPropsRef.current = input.compact;

  const enabledRef = useRef(input.enabled);
  enabledRef.current = input.enabled;
  const sharingRef = useRef(input.isScreenSharing);
  sharingRef.current = input.isScreenSharing;
  const startRef = useRef(input.startScreenshare);
  startRef.current = input.startScreenshare;
  const justOpenedRef = useRef(false);
  const justOpenedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userDismissedRef = useRef(false);

  const paintCompact = useCallback((win: Window) => {
    const props = compactPropsRef.current;
    if (!compactRootRef.current) {
      compactRootRef.current = createRoot(win.document.body);
    }
    compactRootRef.current.render(
      <IleCompactStashWindow
        chapterLabel={props.chapterLabel}
        formingText={props.formingText}
        transcriptText={props.transcriptText}
        isSending={props.isSending}
        heliosTurnMode={props.heliosTurnMode}
        isScreenSharing={props.isScreenSharing}
        onStartShare={() => {
          void startRef.current();
        }}
      />,
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
        // user_dismissed or chrome_auto_closed: this window is gone — next leave must requestWindow.
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
      setMiniFirstAskVisible(false);
      return;
    }

    const result = await runIleLeaveFocusSequence({
      isIleSession: true,
      sessionActive: enabledRef.current,
      tabFocused,
      isScreenSharing: sharingRef.current,
      shareRequestInFlight: shareInFlightRef.current,
      shareDeclined: shareDeclinedRef.current,
      leaveReason,
      startScreenshare: async () => {
        shareInFlightRef.current = true;
        try {
          const started = await startRef.current();
          if (started === false) shareDeclinedRef.current = true;
          if (started === true) shareDeclinedRef.current = false;
          return started;
        } finally {
          shareInFlightRef.current = false;
        }
      },
      readLiveTabFocused: () => readIleTabFocusedFromDocument(),
    });

    const liveFocused = readIleTabFocusedFromDocument();
    const openerHidden = typeof document !== "undefined" ? document.hidden : undefined;
    const pipOnly = shouldUseIleDocumentPipOnly();
    if (!shouldAutoOpenIleMiniOnLeave({ documentPipSupported: pipOnly })) {
      // No Meet-style PiP: leave/visibility must not open, ask, or close a popup.
      if (isIleCompactWindowLive(compactRef.current) && !userDismissedRef.current) {
        paintCompact(compactRef.current!.window);
      }
      return;
    }
    const first = decideIleMiniModeFirstAsk({
      sessionActive: enabledRef.current,
      tabFocused: liveFocused,
      leaveReason,
      consent: consentRef.current,
      documentPipSupported: pipOnly,
    });

    if (first === "ask") {
      // Unreachable for no-PiP (button only). Chrome owns auto-PiP.
      hideCompact();
      setMiniFirstAskVisible(true);
      return;
    }

    const away = isIleAwayFromTab({ tabFocused: liveFocused, leaveReason });
    if (shouldHonorIleMiniModeHide({ first, away })) {
      // Not now / declined: stay-on-leave would still open or re-ask.
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
    // Do not use post-await “opener still focused/visible” to kill a leave-open.
    void result.post.compactWindow;

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
    } else if (
      shouldOpenIlePopupFromButton({
        sessionActive: enabledRef.current,
        documentPipSupported: false,
        reusable: isIlePopupReusable({
          window: compactRef.current?.window,
          userDismissed: userDismissedRef.current,
        }),
      }) &&
      shouldRequestIlePopupOnLeave({
        sessionActive: enabledRef.current,
        away: true,
        documentPipSupported: false,
        reusable: false,
      })
    ) {
      // Leave never requests a popup (shouldRequestIlePopupOnLeave is false).
      handle = await openIleCompactPopupWindow();
      if (
        shouldReaskIleMiniModeForPopup({
          documentPipSupported: false,
          popupBlocked: handle == null,
        })
      ) {
        setMiniFirstAskVisible(true);
        return;
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

  const acceptMiniMode = useCallback(() => {
    consentRef.current = saveIleMiniModeConsent("accepted");
    setMiniFirstAskVisible(false);
    void openCompactFromGesture();
  }, [openCompactFromGesture]);

  const declineMiniMode = useCallback(() => {
    consentRef.current = saveIleMiniModeConsent("declined");
    setMiniFirstAskVisible(false);
    hideCompact();
  }, [hideCompact]);

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
  }, [input.compact, paintCompact]);

  useEffect(() => () => hideCompact({ destroy: true }), [hideCompact]);

  const showManualPicInPic = shouldShowIleOpenPicInPicButton(shouldUseIleDocumentPipOnly());

  return {
    notifyLeaveTab,
    miniFirstAskVisible,
    acceptMiniMode,
    declineMiniMode,
    openManualPicInPic: openCompactFromGesture,
    showManualPicInPic,
  };
}
