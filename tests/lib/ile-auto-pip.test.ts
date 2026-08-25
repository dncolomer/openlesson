/**
 * Chrome automatic Document PiP (Meet-style): Media Session handler
 * opens requestWindow only — never window.open on that path.
 */
import { describe, expect, it } from "vitest";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ILE_AUTO_PIP_MEDIA_ATTR,
  ILE_ENTER_PICTURE_IN_PICTURE_ACTION,
  attachIleAutoPipCaptureElement,
  clearIleEnterPictureInPictureHandler,
  detachIleAutoPipCaptureElement,
  markIleMediaSessionCaptureActive,
  openIleDocumentPictureInPictureWindow,
  registerIleEnterPictureInPictureHandler,
  resolveIleMediaSession,
  decideIlePipStayVsHide,
  shouldDestroyIlePipOnHide,
  interpretIlePipPagehide,
  isIleDocumentPipReusable,
  shouldRequestIleDocumentPipAfterDismiss,
  shouldRequestIleDocumentPipOnLeave,
  shouldUseIleDocumentPipOnly,
  type IleMediaSessionLike,
} from "@/lib/ile-auto-pip";
import {
  decideIleMiniAutoOpen,
  isIleAwayFromTab,
  shouldHonorIleMiniHide,
} from "@/lib/ile-blur-screenshare";
import {
  decideIleMiniWindowKind,
  ileCompactDocumentFillStyles,
  ileCompactRootFillStyle,
  interpretIlePopupOpenResult,
  invokeIleDocumentPipRequestWindow,
  isIleCompactWindowLive,
  ILE_OPEN_PIC_IN_PIC_LABEL,
  isIlePopupReusable,
  openIleAlwaysOnTopWindow,
  openIleCompactPopupWindow,
  resolveLiveIleDocumentPipWindow,
  shouldAutoOpenIleMiniOnLeave,
  shouldKeepIleManualPopupOnReturn,
  shouldOpenIlePopupFromButton,
  shouldShowIleOpenPicInPicButton,
} from "@/lib/ile-compact-window";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-05ef21b98061/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function fakePipWindow() {
  return {
    document: {
      documentElement: { style: {} as CSSStyleDeclaration },
      body: { style: {} as CSSStyleDeclaration },
    },
  } as unknown as Window;
}

function memorySession() {
  const actions: Array<{ action: string; handler: (() => void | Promise<void>) | null }> = [];
  let mic: boolean | null = null;
  const session: IleMediaSessionLike = {
    setActionHandler(action, handler) {
      actions.push({ action, handler });
    },
    setMicrophoneActive(active) {
      mic = active;
    },
  };
  return { session, actions, getMic: () => mic };
}

describe("registerIleEnterPictureInPictureHandler (shipped)", () => {
  it("registers enterpictureinpicture while active and clears when not", async () => {
    const { session, actions, getMic } = memorySession();
    const enters: number[] = [];
    const registered = registerIleEnterPictureInPictureHandler(session, async () => {
      enters.push(1);
    });
    expect(registered).toBe(true);
    expect(actions[0]?.action).toBe(ILE_ENTER_PICTURE_IN_PICTURE_ACTION);
    expect(ILE_ENTER_PICTURE_IN_PICTURE_ACTION).toBe("enterpictureinpicture");
    expect(typeof actions[0]?.handler).toBe("function");

    markIleMediaSessionCaptureActive(session, true);
    expect(getMic()).toBe(true);

    await actions[0]!.handler?.();
    expect(enters).toEqual([1]);

    clearIleEnterPictureInPictureHandler(session);
    expect(actions.at(-1)?.action).toBe(ILE_ENTER_PICTURE_IN_PICTURE_ACTION);
    expect(actions.at(-1)?.handler).toBeNull();
    markIleMediaSessionCaptureActive(session, false);
    expect(getMic()).toBe(false);

    expect(registerIleEnterPictureInPictureHandler(null, () => undefined)).toBe(false);
    expect(resolveIleMediaSession({ mediaSession: session })).toBe(session);
    expect(resolveIleMediaSession({})).toBeNull();

    expect(
      shouldRequestIleDocumentPipOnLeave({
        sessionActive: true,
        compactWindow: "show",
        documentPipSupported: true,
      }),
    ).toBe(true);
    expect(
      shouldRequestIleDocumentPipOnLeave({
        sessionActive: true,
        compactWindow: "hide",
        documentPipSupported: true,
      }),
    ).toBe(false);
    expect(
      shouldRequestIleDocumentPipOnLeave({
        sessionActive: true,
        compactWindow: "show",
        documentPipSupported: false,
      }),
    ).toBe(false);

    const kids: { el: { srcObject: unknown; getAttribute: (n: string) => string | null; remove: () => void } }[] = [];
    const fakeDoc = {
      body: {
        appendChild(el: (typeof kids)[0]["el"]) {
          kids.push({ el });
          return el;
        },
      },
      createElement(tag: string) {
        const node = {
          tagName: tag.toUpperCase(),
          autoplay: false,
          muted: false,
          style: {} as CSSStyleDeclaration,
          srcObject: null as unknown,
          removed: false,
          setAttribute(name: string, value: string) {
            attrs[name] = value;
          },
          getAttribute(name: string) {
            return attrs[name] ?? null;
          },
          play: async () => undefined,
          pause() {},
          remove() {
            node.removed = true;
          },
        };
        const attrs: Record<string, string> = {};
        return node as unknown as HTMLMediaElement;
      },
    };
    const stream = {
      getVideoTracks: () => [],
      getAudioTracks: () => [{ id: "mic" }],
    } as unknown as MediaStream;
    const attached = attachIleAutoPipCaptureElement(stream, fakeDoc as unknown as Document);
    expect(attached).toBeTruthy();
    expect(attached?.getAttribute(ILE_AUTO_PIP_MEDIA_ATTR)).toBe("true");
    expect(kids).toHaveLength(1);
    detachIleAutoPipCaptureElement(attached);
    expect((attached as unknown as { removed: boolean }).removed).toBe(true);
  });
});

describe("openIleDocumentPictureInPictureWindow default window path (shipped)", () => {
  it("calls requestWindow as a method on window.documentPictureInPicture with no inject", async () => {
    const g = globalThis as {
      window?: { documentPictureInPicture?: { requestWindow: (opts?: unknown) => Promise<Window> } };
    };
    const prev = g.window;
    const pipHost = {
      requestWindow(this: unknown) {
        if (this !== pipHost) {
          return Promise.reject(new TypeError("Illegal invocation"));
        }
        return Promise.resolve(fakePipWindow());
      },
    };
    g.window = { documentPictureInPicture: pipHost };

    try {
      const detached = pipHost.requestWindow;
      await expect(detached()).rejects.toThrow(/Illegal invocation/);

      const opened = await openIleDocumentPictureInPictureWindow();
      expect(opened?.kind).toBe("document-pip");

      const always = await openIleAlwaysOnTopWindow();
      expect(always?.kind).toBe("document-pip");
    } finally {
      if (prev === undefined) delete g.window;
      else g.window = prev;
    }
  });
});

describe("openIleDocumentPictureInPictureWindow (shipped)", () => {
  it("calls requestWindow and does not call window.open; failed requestWindow has no popup stand-in", async () => {
    const popups: string[] = [];
    const openPopup = () => {
      popups.push("ile-compact-stash");
      return fakePipWindow();
    };

    const pip = await openIleDocumentPictureInPictureWindow({
      requestPip: async () => fakePipWindow(),
      openPopup,
    });
    expect(pip?.kind).toBe("document-pip");
    expect(popups).toEqual([]);

    const denied = await openIleDocumentPictureInPictureWindow({
      requestPip: async () => {
        throw new Error("NotAllowedError");
      },
      openPopup,
    });
    expect(denied).toBeNull();
    expect(popups).toEqual([]);

    const missing = await openIleDocumentPictureInPictureWindow({
      requestPip: undefined,
      openPopup,
    });
    expect(missing).toBeNull();
    expect(popups).toEqual([]);

    const webidlHost = {
      requestWindow(this: unknown) {
        if (this !== webidlHost) {
          return Promise.reject(new TypeError("Illegal invocation"));
        }
        return Promise.resolve(fakePipWindow());
      },
    };
    const detached = webidlHost.requestWindow;
    await expect(detached()).rejects.toThrow(/Illegal invocation/);
    const bound = await invokeIleDocumentPipRequestWindow(webidlHost, {
      width: 360,
      height: 440,
      disallowReturnToOpener: false,
    });
    expect(bound).toBeTruthy();
    const fromOpen = await openIleDocumentPictureInPictureWindow({
      pipHost: webidlHost,
      openPopup,
    });
    expect(fromOpen?.kind).toBe("document-pip");
    const fromAlways = await openIleAlwaysOnTopWindow({
      pipHost: webidlHost,
      openPopup,
    });
    expect(fromAlways?.kind).toBe("document-pip");
    expect(popups).toEqual([]);

    const alwaysDenied = await openIleAlwaysOnTopWindow({
      requestPip: async () => {
        throw new Error("NotAllowedError");
      },
      openPopup,
    });
    expect(alwaysDenied).toBeNull();
    expect(popups).toEqual([]);

    expect(shouldUseIleDocumentPipOnly({ documentPictureInPicture: { requestWindow: async () => fakePipWindow() } })).toBe(
      true,
    );
    expect(shouldUseIleDocumentPipOnly({})).toBe(false);

    const chromeOpen = decideIleMiniAutoOpen({
      sessionActive: true,
      tabFocused: false,
      leaveReason: "tab_hidden",
      documentPipSupported: true,
    });
    expect(chromeOpen).toBe("open");
    expect(chromeOpen).not.toBe("ask");

    writeScratch(
      "ile-auto-pip-helper.txt",
      [
        `handlerAction=${ILE_ENTER_PICTURE_IN_PICTURE_ACTION}`,
        `pipKind=${pip?.kind}`,
        `denied=${denied}`,
        `popupCalls=${popups.length}`,
        `chromeOpen=${chromeOpen}`,
      ].join("\n"),
    );
  });
});

describe("decideIlePipStayVsHide (shipped)", () => {
  it("stays after open / transient focus / pagehide; hides only on real ILE return or session off", async () => {
    const awayOpen = decideIlePipStayVsHide({
      sessionActive: true,
      event: "open_complete",
      openerHidden: false,
      openerHasFocus: true,
      justOpened: true,
    });
    expect(awayOpen).toBe("stay");

    const pagehide = decideIlePipStayVsHide({
      sessionActive: true,
      event: "pip_pagehide",
      openerHidden: false,
      openerHasFocus: true,
    });
    expect(pagehide).toBe("stay");

    const postOpenFocus = decideIlePipStayVsHide({
      sessionActive: true,
      event: "opener_focus",
      openerHidden: false,
      openerHasFocus: true,
      justOpened: true,
    });
    expect(postOpenFocus).toBe("stay");

    const leave = decideIlePipStayVsHide({
      sessionActive: true,
      event: "leave",
      leaveReason: "tab_blur",
      openerHidden: false,
      openerHasFocus: false,
    });
    expect(leave).toBe("stay");

    const otherTab = decideIlePipStayVsHide({
      sessionActive: true,
      event: "visibility",
      openerHidden: true,
      openerHasFocus: false,
    });
    expect(otherTab).toBe("stay");

    const reallyBack = decideIlePipStayVsHide({
      sessionActive: true,
      event: "opener_focus",
      openerHidden: false,
      openerHasFocus: true,
      justOpened: false,
    });
    expect(reallyBack).toBe("hide");

    const popupBack = decideIlePipStayVsHide({
      sessionActive: true,
      event: "opener_focus",
      openerHidden: false,
      openerHasFocus: true,
      justOpened: false,
      kind: "popup",
    });
    expect(popupBack).toBe("stay");

    const sessionOff = decideIlePipStayVsHide({
      sessionActive: false,
      event: "session_off",
    });
    expect(sessionOff).toBe("hide");

    const popupPaused = decideIlePipStayVsHide({
      sessionActive: false,
      event: "session_off",
      kind: "popup",
    });
    expect(popupPaused).toBe("stay");

    expect(shouldDestroyIlePipOnHide({ sessionActive: true, reason: "return" })).toBe(false);
    expect(shouldDestroyIlePipOnHide({ sessionActive: true, reason: "session_off" })).toBe(true);
    expect(shouldDestroyIlePipOnHide({ sessionActive: false, reason: "return" })).toBe(true);
    expect(
      shouldDestroyIlePipOnHide({ sessionActive: false, reason: "session_off", kind: "popup" }),
    ).toBe(false);

    const liveWin = fakePipWindow();
    expect(isIleCompactWindowLive({ window: liveWin })).toBe(true);
    expect(isIleCompactWindowLive({ window: { closed: true } as Window })).toBe(false);
    expect(resolveLiveIleDocumentPipWindow({ window: liveWin })).toBe(liveWin);
    expect(resolveLiveIleDocumentPipWindow({ window: { closed: true } as Window })).toBeNull();

    let requested = 0;
    const reuseHost = {
      window: liveWin,
      requestWindow: async () => {
        requested += 1;
        return fakePipWindow();
      },
    };
    const reused = await openIleDocumentPictureInPictureWindow({ pipHost: reuseHost });
    expect(reused?.window).toBe(liveWin);
    expect(requested).toBe(0);

    const secondLeave = decideIlePipStayVsHide({
      sessionActive: true,
      event: "leave",
      leaveReason: "tab_hidden",
      openerHidden: true,
      openerHasFocus: false,
      justOpened: false,
    });
    expect(secondLeave).toBe("stay");

    expect(isIleDocumentPipReusable({ window: liveWin })).toBe(true);
    expect(isIleDocumentPipReusable({ window: { closed: true } })).toBe(false);
    expect(isIleDocumentPipReusable({ window: liveWin, userDismissed: true })).toBe(false);
    expect(interpretIlePipPagehide({ openerHidden: true, justOpened: false })).toBe(
      "user_dismissed",
    );
    expect(interpretIlePipPagehide({ openerHidden: true, justOpened: true })).toBe("ignore");
    expect(interpretIlePipPagehide({ openerHidden: false, windowClosed: true })).toBe(
      "user_dismissed",
    );
    expect(interpretIlePipPagehide({ openerHidden: false, windowClosed: false })).toBe(
      "user_dismissed",
    );
    expect(
      shouldRequestIleDocumentPipAfterDismiss({
        sessionActive: true,
        away: true,
        reusable: false,
        documentPipSupported: true,
      }),
    ).toBe(true);
    expect(
      shouldRequestIleDocumentPipAfterDismiss({
        sessionActive: true,
        away: true,
        reusable: true,
        documentPipSupported: true,
      }),
    ).toBe(false);

    let dismissedRequests = 0;
    const dismissedHost = {
      window: liveWin,
      requestWindow: async () => {
        dismissedRequests += 1;
        return fakePipWindow();
      },
    };
    const afterClose = await openIleDocumentPictureInPictureWindow({
      pipHost: dismissedHost,
      userDismissed: true,
    });
    expect(dismissedRequests).toBe(1);
    expect(afterClose?.window).not.toBe(liveWin);

    writeScratch(
      "ile-pip-stay-helper.txt",
      [
        `open_complete=${awayOpen}`,
        `pip_pagehide=${pagehide}`,
        `justOpened_focus=${postOpenFocus}`,
        `leave=${leave}`,
        `otherTab=${otherTab}`,
        `reallyBack=${reallyBack}`,
        `sessionOff=${sessionOff}`,
        `destroyOnReturn=${shouldDestroyIlePipOnHide({ sessionActive: true, reason: "return" })}`,
        `secondLeave=${secondLeave}`,
        `reuseRequested=${requested}`,
        `dismissedRequests=${dismissedRequests}`,
        `pagehideAway=${interpretIlePipPagehide({ openerHidden: true, justOpened: false })}`,
      ].join("\n"),
    );
  });
});

describe("user-closed PiP reopens on next leave (shipped helpers)", () => {
  it("dismissed/closed window is not reused; away-again still calls requestWindow", async () => {
    const live = fakePipWindow();
    const closed = { closed: true } as Window;
    expect(isIleDocumentPipReusable({ window: live })).toBe(true);
    expect(isIleDocumentPipReusable({ window: closed })).toBe(false);
    expect(isIleDocumentPipReusable({ window: live, userDismissed: true })).toBe(false);

    const pagehideAway = interpretIlePipPagehide({
      openerHidden: true,
      windowClosed: true,
      justOpened: false,
    });
    expect(pagehideAway).toBe("user_dismissed");
    const leftoverClose = interpretIlePipPagehide({
      openerHidden: false,
      windowClosed: true,
      justOpened: false,
    });
    expect(leftoverClose).toBe("user_dismissed");

    const awayAgain = shouldRequestIleDocumentPipAfterDismiss({
      sessionActive: true,
      away: true,
      reusable: isIleDocumentPipReusable({ window: closed, userDismissed: true }),
      documentPipSupported: true,
    });
    expect(awayAgain).toBe(true);

    let requestWindowCalls = 0;
    const host = {
      window: live,
      requestWindow: async () => {
        requestWindowCalls += 1;
        return fakePipWindow();
      },
    };
    const reopened = await openIleDocumentPictureInPictureWindow({
      pipHost: host,
      userDismissed: true,
    });
    expect(requestWindowCalls).toBe(1);
    expect(reopened?.kind).toBe("document-pip");
    expect(reopened?.window).not.toBe(live);

    const reused = await openIleDocumentPictureInPictureWindow({
      pipHost: host,
      userDismissed: false,
    });
    expect(reused?.window).toBe(live);

    const hook = read("lib/useIleBlurScreenshare.tsx");
    expect(hook).toContain("interpretIlePipPagehide");
    expect(hook).toContain('verdict === "ignore"');
    expect(hook).toContain("userDismissedRef.current = true");
    expect(hook).toContain("userDismissed: userDismissedRef.current");
    expect(hook).toContain("shouldRequestIleDocumentPipAfterDismiss");
    expect(hook).not.toContain("popup=yes");
    expect(read("lib/ile-auto-pip.ts")).not.toContain("ile-compact-stash");

    writeScratch(
      "ile-pip-reopen-excerpts.txt",
      [
        `pagehideAway=${pagehideAway}`,
        `leftoverClose=${leftoverClose}`,
        `reusableAfterClose=${isIleDocumentPipReusable({ window: closed, userDismissed: true })}`,
        `awayAgainRequests=${awayAgain}`,
        `requestWindowCalls=${requestWindowCalls}`,
        "leave path: user_dismissed → drop handle → next leave requestWindow",
        "no popup=yes / ile-compact-stash on Document PiP reopen",
      ].join("\n"),
    );
  });
});

describe("popup fallback when Document PiP is absent (shipped helpers)", () => {
  it("does not auto-open on leave; button opens popup; return does not close it", async () => {
    expect(decideIleMiniWindowKind(true)).toBe("document-pip");
    expect(decideIleMiniWindowKind(false)).toBe("popup");
    expect(shouldAutoOpenIleMiniOnLeave({ documentPipSupported: true })).toBe(true);
    expect(shouldAutoOpenIleMiniOnLeave({ documentPipSupported: false })).toBe(false);
    expect(shouldShowIleOpenPicInPicButton(false)).toBe(true);
    expect(shouldShowIleOpenPicInPicButton(true)).toBe(false);
    expect(ILE_OPEN_PIC_IN_PIC_LABEL).toBe("open pic-in-pic");

    expect(interpretIlePopupOpenResult(null)).toBe("blocked");
    expect(interpretIlePopupOpenResult(fakePipWindow())).toBe("opened");
    expect(isIlePopupReusable({ window: fakePipWindow() })).toBe(true);
    expect(isIlePopupReusable({ window: { closed: true } })).toBe(false);
    expect(isIlePopupReusable({ window: fakePipWindow(), userDismissed: true })).toBe(false);

    expect(
      shouldOpenIlePopupFromButton({
        sessionActive: true,
        documentPipSupported: false,
        reusable: false,
      }),
    ).toBe(true);
    expect(
      shouldOpenIlePopupFromButton({
        sessionActive: true,
        documentPipSupported: true,
        reusable: false,
      }),
    ).toBe(false);
    const declinedOpen = decideIleMiniAutoOpen({
      sessionActive: true,
      tabFocused: false,
      leaveReason: "tab_blur",
    });
    const declinedAway = isIleAwayFromTab({
      tabFocused: false,
      leaveReason: "tab_blur",
    });
    const focusedOpen = decideIleMiniAutoOpen({
      sessionActive: true,
      tabFocused: true,
      leaveReason: null,
    });
    const focusedAway = isIleAwayFromTab({
      tabFocused: true,
      leaveReason: null,
    });
    expect(declinedOpen).toBe("hide");
    expect(shouldHonorIleMiniHide({ decision: declinedOpen, away: declinedAway })).toBe(
      true,
    );
    expect(shouldHonorIleMiniHide({ decision: focusedOpen, away: focusedAway })).toBe(
      false,
    );

    expect(shouldDestroyIlePipOnHide({ sessionActive: true, reason: "return", kind: "popup" })).toBe(
      false,
    );
    expect(
      shouldDestroyIlePipOnHide({ sessionActive: true, reason: "return", kind: "document-pip" }),
    ).toBe(false);
    expect(
      shouldKeepIleManualPopupOnReturn({ kind: "popup", sessionActive: true }),
    ).toBe(true);
    expect(
      shouldKeepIleManualPopupOnReturn({ kind: "document-pip", sessionActive: true }),
    ).toBe(false);
    expect(
      shouldKeepIleManualPopupOnReturn({ kind: "popup", sessionActive: false }),
    ).toBe(true);
    expect(
      shouldDestroyIlePipOnHide({ sessionActive: false, reason: "session_off", kind: "popup" }),
    ).toBe(false);

    let popupOpens = 0;
    const fakePopup = fakePipWindow();
    const opened = await openIleCompactPopupWindow({
      openPopup: () => {
        popupOpens += 1;
        return fakePopup;
      },
    });
    expect(opened?.kind).toBe("popup");
    expect(popupOpens).toBe(1);

    const blocked = await openIleCompactPopupWindow({
      openPopup: () => null,
    });
    expect(blocked).toBeNull();
    expect(interpretIlePopupOpenResult(null)).toBe("blocked");

    expect(
      shouldOpenIlePopupFromButton({
        sessionActive: true,
        documentPipSupported: false,
        reusable: isIlePopupReusable({ window: { closed: true }, userDismissed: true }),
      }),
    ).toBe(true);

    let pipPopupCalls = 0;
    const pipOnly = await openIleDocumentPictureInPictureWindow({
      requestPip: async () => fakePipWindow(),
      openPopup: () => {
        pipPopupCalls += 1;
        return fakePopup;
      },
    });
    expect(pipOnly?.kind).toBe("document-pip");
    expect(pipPopupCalls).toBe(0);

    const hook = read("lib/useIleBlurScreenshare.tsx");
    expect(hook).toContain("openIleCompactPopupWindow");
    expect(hook).toContain("decideIleMiniWindowKind");
    expect(hook).toContain("shouldAutoOpenIleMiniOnLeave");
    expect(hook).toContain("shouldKeepIleManualPopupOnReturn");
    expect(hook).toContain("openManualPicInPic");
    expect(hook).toContain("IleCompactStashWindow");
    expect(hook).not.toContain("openIleAlwaysOnTopWindow");
    const applyStart = hook.indexOf("const applyDecision");
    const applyEnd = hook.indexOf("const openCompactFromGesture");
    const applyBody = hook.slice(applyStart, applyEnd);
    expect(applyBody).toContain("shouldAutoOpenIleMiniOnLeave");
    expect(applyBody).not.toContain("openIleCompactPopupWindow");
    expect(applyBody).not.toContain("shouldRequestIlePopupOnLeave");

    const tools = read("components/ToolsPanel.tsx");
    const view = readSessionViewSurface();
    expect(tools).toContain("ILE_OPEN_PIC_IN_PIC_LABEL");
    expect(tools).toContain("data-ile-open-pic-in-pic");
    expect(tools.indexOf("ILE_OPEN_PIC_IN_PIC_LABEL")).toBeLessThan(tools.indexOf("bottomTools.map"));
    expect(view).toContain("showOpenPicInPic={showManualPicInPic}");
    expect(view).toContain("onOpenPicInPic={openManualPicInPic}");

    writeScratch(
      "ile-manual-pip-button-excerpts.txt",
      [
        `kindWithoutPip=${decideIleMiniWindowKind(false)}`,
        `kindWithPip=${decideIleMiniWindowKind(true)}`,
        `autoLeaveWithoutPip=${shouldAutoOpenIleMiniOnLeave({ documentPipSupported: false })}`,
        `autoLeaveWithPip=${shouldAutoOpenIleMiniOnLeave({ documentPipSupported: true })}`,
        `buttonOpensPopup=${shouldOpenIlePopupFromButton({
          sessionActive: true,
          documentPipSupported: false,
          reusable: false,
        })}`,
        `blocked=${interpretIlePopupOpenResult(null)}`,
        `keepPopupOnReturn=${shouldKeepIleManualPopupOnReturn({ kind: "popup", sessionActive: true })}`,
        `keepPopupOnPause=${shouldKeepIleManualPopupOnReturn({ kind: "popup", sessionActive: false })}`,
        `destroyPopupOnReturn=${shouldDestroyIlePipOnHide({ sessionActive: true, reason: "return", kind: "popup" })}`,
        `destroyPopupOnPause=${shouldDestroyIlePipOnHide({ sessionActive: false, reason: "session_off", kind: "popup" })}`,
        `label=${ILE_OPEN_PIC_IN_PIC_LABEL}`,
        `pipPathPopupCalls=${pipPopupCalls}`,
        "no-PiP leave: no window.open / no first-ask; button above Help opens popup",
        "button-opened popup stays on ILE return/focus/visibility",
        "Document PiP present: requestWindow only, no popup stand-in",
      ].join("\n"),
    );
  });
});

describe("PiP content height fills the live window (shipped helpers)", () => {
  it("document + compact root fill 100% and do not pin leftover minHeight", () => {
    const fill = ileCompactDocumentFillStyles();
    expect(fill.html.height).toBe("100%");
    expect(fill.body.height).toBe("100%");
    const root = ileCompactRootFillStyle();
    expect(root.height).toBe(fill.html.height);
    expect(root.minHeight).toBe(0);

    const compactLib = read("lib/ile-compact-window.ts");
    expect(compactLib).toContain("ileCompactDocumentFillStyles");
    expect(compactLib).toContain("doc.documentElement.style.height = fill.html.height");
    expect(compactLib).toContain("doc.body.style.height = fill.body.height");
    expect(compactLib).toContain("invokeIleDocumentPipRequestWindow");

    const surface = read("components/IleCompactStashWindow.tsx");
    expect(surface).toContain("ileCompactRootFillStyle");
    expect(surface).toContain("data-ile-compact-transcript");
    expect(surface).toContain("data-ile-compact-share-cta");
    expect(surface).toContain("data-ile-compact-done-answering");
    expect(surface).toContain("data-ile-compact-autostash");
    expect(surface).not.toContain("data-ile-compact-forming");
    expect(surface).not.toContain("data-ile-last-stash");
    expect(surface).not.toMatch(/minHeight:\s*280/);
    expect(surface).not.toContain("popup=yes");

    writeScratch(
      "ile-pip-height-excerpts.txt",
      [
        `htmlHeight=${fill.html.height}`,
        `bodyHeight=${fill.body.height}`,
        `rootHeight=${root.height}`,
        `rootMinHeight=${root.minHeight}`,
        "no leftover minHeight 280 on compact root",
        "open path still requestWindow / invokeIleDocumentPipRequestWindow",
      ].join("\n"),
    );
  });
});

describe("auto-PiP wiring (shipped source)", () => {
  it("hook registers enterpictureinpicture and opens Document PiP only; no in-app 3-choice Chrome clone", () => {
    const hook = read("lib/useIleBlurScreenshare.tsx");
    const auto = read("lib/ile-auto-pip.ts");
    const compact = read("lib/ile-compact-window.ts");
    const view = readSessionViewSurface();
    expect(existsSync(join(ROOT, "components/IleMiniModeFirstAsk.tsx"))).toBe(false);

    expect(hook).toContain("registerIleEnterPictureInPictureHandler");
    expect(hook).toContain("clearIleEnterPictureInPictureHandler");
    expect(hook).toContain("openIleDocumentPictureInPictureWindow");
    expect(hook).toContain("markIleMediaSessionCaptureActive");
    expect(hook).toContain("attachIleAutoPipCaptureElement");
    expect(hook).toContain("shouldRequestIleDocumentPipOnLeave");
    expect(hook).toContain("decideIlePipStayVsHide");
    expect(hook).toContain("shouldDestroyIlePipOnHide");
    expect(hook).toContain("isIleCompactWindowLive");
    expect(hook).toContain('event: "open_complete"');
    expect(hook).toContain("interpretIlePipPagehide");
    expect(hook).toContain("userDismissed");
    expect(hook).toContain("shouldRequestIleDocumentPipAfterDismiss");
    expect(hook).toContain("justOpened");
    expect(hook).toContain("shouldUseIleDocumentPipOnly");
    expect(hook).toContain("documentPipSupported: pipOnly");
    expect(hook).not.toContain("if (pipOnly) return");
    expect(hook).not.toContain("addEventListener(\"pagehide\", hideCompact)");
    expect(hook).not.toMatch(
      /if \(readIleTabFocusedFromDocument\(\)\) \{\s*closeIleAlwaysOnTopWindow/,
    );
    expect(hook).not.toContain("Allow this time");
    expect(hook).not.toContain("Allow on every visit");
    expect(hook).not.toContain("Don’t allow");

    expect(auto).toContain('setActionHandler(ILE_ENTER_PICTURE_IN_PICTURE_ACTION');
    expect(auto).toContain("invokeIleDocumentPipRequestWindow");
    expect(auto).toContain("resolveIleDocumentPipHost");
    expect(auto).toContain("kind: \"document-pip\"");
    expect(compact).toContain("host.requestWindow(options)");
    expect(compact).toContain("invokeIleDocumentPipRequestWindow");
    expect(auto).not.toContain("window.open(");
    expect(auto).not.toContain("ile-compact-stash");
    expect(auto).not.toContain("popup=yes");

    expect(compact).toContain("never a popup stand-in when Document PiP exists");
    expect(view).toContain("getUserMedia");
    expect(view).toContain("useIleBlurScreenshare");
    expect(view).toContain("captureStream: stream");

    expect(view).not.toContain("IleMiniModeFirstAsk");
    expect(view).not.toContain("ileMiniModeFirstAskCopy");

    writeScratch(
      "ile-auto-pip-excerpts.txt",
      [
        "Media Session setActionHandler(enterpictureinpicture)",
        "handler + leave-tab both call openIleDocumentPictureInPictureWindow",
        "user close (pagehide while away) → user_dismissed; next leave requestWindow",
        "closed / userDismissed window is not reusable",
        "no popup=yes / ile-compact-stash when Document PiP exists",
        "SessionView passes captureStream: stream",
      ].join("\n"),
    );
  });
});
