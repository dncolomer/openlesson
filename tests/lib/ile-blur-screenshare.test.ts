/**
 * ILE leave-focus screenshare + compact stash window policy.
 * Drives the shipped helpers SessionView / Grok-Grokipedia call.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyIleCompactWindowAfterShareAwait,
  applyIleLeaveFocusPolicy,
  decideIleCompactWindow,
  decideIleLeaveFocusScreenshare,
  ileMiniModeShareScreenNote,
  ileTabIsFocused,
  openIleExternalLeaveTab,
  shouldShowIleMiniShareScreenNote,
} from "@/lib/ile-blur-screenshare";
import { isScreenCaptureUserDenied } from "@/lib/screen-capture";
import {
  ileCompactPopupFeatures,
  ILE_COMPACT_WINDOW_HEIGHT,
  ILE_COMPACT_WINDOW_WIDTH,
  isIleDocumentPipSupported,
  openIleAlwaysOnTopWindow,
} from "@/lib/ile-compact-window";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-2970d405d009/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

const ileActive = {
  isIleSession: true,
  sessionActive: true,
  isScreenSharing: false,
};

describe("applyIleLeaveFocusPolicy (shipped ILE leave-focus helper)", () => {
  it("ILE + hidden/blurred or Grok/Grokipedia leave ⇒ no auto share, show mini window", () => {
    const hidden = applyIleLeaveFocusPolicy({
      ...ileActive,
      tabFocused: false,
      leaveReason: "tab_hidden",
    });
    expect(hidden.screenshare).toBe("skip");
    expect(hidden.compactWindow).toBe("show");

    const blur = applyIleLeaveFocusPolicy({
      ...ileActive,
      tabFocused: false,
      leaveReason: "tab_blur",
    });
    expect(blur.screenshare).toBe("skip");
    expect(blur.compactWindow).toBe("show");

    const grok = applyIleLeaveFocusPolicy({
      ...ileActive,
      tabFocused: true,
      leaveReason: "grok",
    });
    expect(grok.screenshare).toBe("skip");
    expect(grok.compactWindow).toBe("show");

    const wiki = applyIleLeaveFocusPolicy({
      ...ileActive,
      tabFocused: true,
      leaveReason: "grokipedia",
    });
    expect(wiki.screenshare).toBe("skip");
    expect(wiki.compactWindow).toBe("show");

    expect(decideIleLeaveFocusScreenshare({ ...ileActive, tabFocused: false })).toBe("skip");
    expect(decideIleCompactWindow({ ...ileActive, tabFocused: false })).toBe("show");

    writeScratch(
      "ile-leave-no-force-share.txt",
      [
        `hidden=${hidden.screenshare}/${hidden.compactWindow}`,
        `blur=${blur.screenshare}/${blur.compactWindow}`,
        `grok=${grok.screenshare}/${grok.compactWindow}`,
        `grokipedia=${wiki.screenshare}/${wiki.compactWindow}`,
      ].join("\n"),
    );
  });

  it("user-denied picker is a quiet cancel and does not re-prompt", async () => {
    const denied = new DOMException("Permission denied by user", "NotAllowedError");
    expect(isScreenCaptureUserDenied(denied)).toBe(true);
    expect(isScreenCaptureUserDenied(new DOMException("The user aborted", "AbortError"))).toBe(
      true,
    );
    expect(isScreenCaptureUserDenied(new Error("device missing"))).toBe(false);

    expect(
      decideIleLeaveFocusScreenshare({
        ...ileActive,
        tabFocused: false,
        leaveReason: "tab_blur",
      }),
    ).toBe("skip");
    expect(
      decideIleCompactWindow({
        ...ileActive,
        tabFocused: false,
        leaveReason: "tab_blur",
      }),
    ).toBe("show");

    const afterDenyPre = applyIleLeaveFocusPolicy({
      ...ileActive,
      tabFocused: false,
      leaveReason: "tab_hidden",
    });
    const afterDenyPost = applyIleCompactWindowAfterShareAwait({
      isIleSession: true,
      sessionActive: true,
      tabFocused: false,
      isScreenSharing: false,
    });
    expect(afterDenyPre.screenshare).toBe("skip");
    expect(afterDenyPost.compactWindow).toBe("show");

    const capture = read("lib/screen-capture.ts");
    expect(capture).toContain("isScreenCaptureUserDenied");
    expect(capture).toContain("isScreenCaptureStartQuietFailure");
    expect(capture).toMatch(
      /if \(isScreenCaptureStartQuietFailure\(err\)\) \{\s*return false;/,
    );
    expect(capture).not.toMatch(
      /console\.error\([\s\S]{0,80}NotAllowedError/,
    );
  });

  it("already sharing does not re-prompt; focused ILE tab hides the compact window", () => {
    const already = applyIleLeaveFocusPolicy({
      ...ileActive,
      tabFocused: false,
      isScreenSharing: true,
      leaveReason: "tab_hidden",
    });
    expect(already.screenshare).toBe("already_on");
    expect(already.compactWindow).toBe("show");

    const inFlight = applyIleLeaveFocusPolicy({
      ...ileActive,
      tabFocused: false,
      shareRequestInFlight: true,
    });
    expect(inFlight.screenshare).toBe("already_on");

    const focused = applyIleLeaveFocusPolicy({
      ...ileActive,
      tabFocused: true,
      isScreenSharing: true,
      leaveReason: null,
    });
    expect(focused.screenshare).toBe("skip");
    expect(focused.compactWindow).toBe("hide");
    expect(ileTabIsFocused({ hidden: false, hasFocus: true })).toBe(true);
    expect(ileTabIsFocused({ hidden: true, hasFocus: true })).toBe(false);
  });

  it("non-ILE / inactive session never auto-shares or opens the compact window", () => {
    const tap = applyIleLeaveFocusPolicy({
      isIleSession: false,
      sessionActive: true,
      tabFocused: false,
      isScreenSharing: false,
      leaveReason: "tab_hidden",
    });
    expect(tap.screenshare).toBe("skip");
    expect(tap.compactWindow).toBe("hide");

    const paused = applyIleLeaveFocusPolicy({
      isIleSession: true,
      sessionActive: false,
      tabFocused: false,
      isScreenSharing: false,
    });
    expect(paused.screenshare).toBe("skip");
    expect(paused.compactWindow).toBe("hide");
  });

  it("after getDisplayMedia, compact window follows live focus not the stale leave reason", async () => {
    const grokPre = applyIleLeaveFocusPolicy({
      ...ileActive,
      tabFocused: true,
      leaveReason: "grok",
    });
    const grokPost = applyIleCompactWindowAfterShareAwait({
      isIleSession: true,
      sessionActive: true,
      tabFocused: true,
      isScreenSharing: false,
    });
    expect(grokPre.screenshare).toBe("skip");
    expect(grokPre.compactWindow).toBe("show");
    expect(grokPost.compactWindow).toBe("hide");
    expect(grokPost.screenshare).toBe("skip");

    const stillAwayPre = applyIleLeaveFocusPolicy({
      ...ileActive,
      tabFocused: false,
      leaveReason: "grokipedia",
    });
    const stillAwayPost = applyIleCompactWindowAfterShareAwait({
      isIleSession: true,
      sessionActive: true,
      tabFocused: false,
      isScreenSharing: false,
    });
    expect(stillAwayPre.screenshare).toBe("skip");
    expect(stillAwayPost.compactWindow).toBe("show");

    const returnedDuringPicker = applyIleCompactWindowAfterShareAwait({
      isIleSession: true,
      sessionActive: true,
      tabFocused: true,
      isScreenSharing: false,
    });
    expect(returnedDuringPicker.compactWindow).toBe("hide");

    const afterAwaitFocused = applyIleCompactWindowAfterShareAwait({
      isIleSession: true,
      sessionActive: true,
      tabFocused: true,
      isScreenSharing: true,
    });
    expect(afterAwaitFocused.compactWindow).toBe("hide");
  });

  it("Grok/Grokipedia leave helper notifies policy then opens the URL", () => {
    const opened: string[] = [];
    const reasons: string[] = [];
    const result = openIleExternalLeaveTab({
      url: "https://grok.com/?q=avl",
      reason: "grok",
      openWindow: (url) => {
        opened.push(url);
        return null;
      },
      onLeave: (reason) => reasons.push(reason),
    });
    expect(result.left).toBe(true);
    expect(result.reason).toBe("grok");
    expect(reasons).toEqual(["grok"]);
    expect(opened).toEqual(["https://grok.com/?q=avl"]);
  });

  it("compact window helper prefers PiP and degrades to a bottom-right popup", async () => {
    const features = ileCompactPopupFeatures(360, 440, {
      availLeft: 0,
      availTop: 0,
      availWidth: 1920,
      availHeight: 1080,
    });
    expect(features).toMatch(/width=360/);
    expect(features).toMatch(/height=440/);
    expect(features).toMatch(/left=1544/);
    expect(features).toMatch(/top=584/);
    expect(ILE_COMPACT_WINDOW_WIDTH).toBe(360);
    expect(ILE_COMPACT_WINDOW_HEIGHT).toBe(440);

    const fakePip = {
      document: { documentElement: { style: {} as CSSStyleDeclaration }, body: { style: {} as CSSStyleDeclaration } },
    } as unknown as Window;
    const pip = await openIleAlwaysOnTopWindow({
      requestPip: async () => fakePip,
    });
    expect(pip?.kind).toBe("document-pip");
    expect(isIleDocumentPipSupported({ documentPictureInPicture: { requestWindow: async () => fakePip } })).toBe(true);
    expect(isIleDocumentPipSupported({})).toBe(false);

    const fakePopup = {
      document: { documentElement: { style: {} as CSSStyleDeclaration }, body: { style: {} as CSSStyleDeclaration } },
    } as unknown as Window;
    const pipDenied = await openIleAlwaysOnTopWindow({
      requestPip: async () => {
        throw new Error("NotAllowedError");
      },
      openPopup: () => fakePopup,
    });
    expect(pipDenied).toBeNull();

    const popup = await openIleAlwaysOnTopWindow({
      openPopup: () => fakePopup,
    });
    expect(popup?.kind).toBe("popup");

    const denied = await openIleAlwaysOnTopWindow({
      requestPip: async () => {
        throw new Error("NotAllowedError");
      },
      openPopup: () => null,
    });
    expect(denied).toBeNull();

    const hidden = applyIleLeaveFocusPolicy({
      ...ileActive,
      tabFocused: false,
      leaveReason: "tab_hidden",
    });
    const already = applyIleLeaveFocusPolicy({
      ...ileActive,
      tabFocused: false,
      isScreenSharing: true,
    });
    const focusedNow = applyIleLeaveFocusPolicy({
      ...ileActive,
      tabFocused: true,
      isScreenSharing: true,
    });
    const nonIle = applyIleLeaveFocusPolicy({
      isIleSession: false,
      sessionActive: true,
      tabFocused: false,
      isScreenSharing: false,
    });

    writeScratch(
      "ile-blur-share-policy.txt",
      [
        `hidden=${hidden.screenshare}/${hidden.compactWindow}`,
        `already=${already.screenshare}/${already.compactWindow}`,
        `focused=${focusedNow.screenshare}/${focusedNow.compactWindow}`,
        `nonIle=${nonIle.screenshare}/${nonIle.compactWindow}`,
        `pip=${pip?.kind}`,
        `popupWhenNoPipApi=${popup?.kind}`,
        `pipDeniedNoPopup=${pipDenied}`,
        `denied=${denied}`,
        `postAwaitFocusedHide=${applyIleCompactWindowAfterShareAwait({
          isIleSession: true,
          sessionActive: true,
          tabFocused: true,
          isScreenSharing: true,
        }).compactWindow}`,
      ].join("\n"),
    );
  });
});

describe("ILE leave-focus wiring (shipped source)", () => {
  it("SessionView + Grok/Grokipedia call the policy and existing getDisplayMedia start", () => {
    const view = read("components/SessionView.tsx");
    expect(view).toContain("useIleBlurScreenshare");
    expect(view).toContain("handleStartScreenCapture");
    expect(view).toContain("notifyLeaveTab");
    expect(view).toContain("onLeaveIleTab={notifyLeaveTab}");

    const hook = read("lib/useIleBlurScreenshare.tsx");
    expect(hook).toContain("readIleTabFocusedFromDocument");
    expect(hook).toContain("openIleCompactPopupWindow");
    expect(hook).toContain("IleCompactStashWindow");
    expect(hook).toContain("visibilitychange");
    expect(hook).toContain("startScreenshare");
    expect(hook).not.toContain("shouldRequestIlePopupOnLeave");
    expect(hook).not.toContain("result.post.compactWindow");
    expect(hook).not.toContain("shareDeclined");

    const grok = read("components/GrokGrokipediaTool.tsx");
    expect(grok).toContain("openIleExternalLeaveTab");
    expect(grok).toContain("onLeaveIleTab");
    expect(grok).toContain('reason: "grokipedia"');
    expect(grok).toContain('reason: "grok"');

    const capture = read("lib/screen-capture.ts");
    expect(capture).toContain("getDisplayMedia");
    expect(capture).toContain("NotAllowedError");

    const compact = read("components/IleCompactStashWindow.tsx");
    expect(compact).toContain("data-ile-compact-stash");
    expect(compact).toContain('data-ile-compact-anchor="bottom-right"');
    expect(compact).toContain("data-ile-compact-always-on-top");
    expect(compact).toContain("ileMiniModeShareCtaLabel");
    expect(compact).toContain("data-ile-compact-share-cta");
    expect(compact).toContain("<button");
    expect(compact).not.toContain("CompactList");
    expect(view).toContain("handleStartScreenCapture");
    const policy = read("lib/ile-blur-screenshare.ts");
    expect(policy).toContain("never auto-opens getDisplayMedia");
    expect(policy).toContain('return "skip"');

    const note = ileMiniModeShareScreenNote();
    expect(note.toLowerCase()).toMatch(/share/);
    expect(note.toLowerCase()).toMatch(/screen/);
    expect(note.toLowerCase()).toMatch(/mini mode/);
    expect(shouldShowIleMiniShareScreenNote(false)).toBe(true);
    expect(shouldShowIleMiniShareScreenNote(true)).toBe(false);

    writeScratch(
      "ile-mini-share-note.txt",
      [
        `note=${note}`,
        `showWhenNotSharing=${shouldShowIleMiniShareScreenNote(false)}`,
        `hideWhenSharing=${shouldShowIleMiniShareScreenNote(true)}`,
        "IleCompactStashWindow renders data-ile-compact-share-cta",
      ].join("\n"),
    );
    writeScratch(
      "ile-leave-share-excerpts.txt",
      [
        "leave policy: screenshare=skip + compact=show",
        "leave sequence never auto-requests screenshare",
        "SessionView: handleStartScreenCapture remains for manual share",
        "IleCompactStashWindow: ileMiniModeShareCtaLabel",
      ].join("\n"),
    );

    const tap = read("components/TapScoreClient.tsx");
    expect(tap).not.toContain("useIleBlurScreenshare");
    expect(tap).not.toContain("applyIleLeaveFocusPolicy");

    writeScratch(
      "ile-blur-share-excerpts.txt",
      [
        "SessionView: useIleBlurScreenshare + handleStartScreenCapture + onLeaveIleTab",
        "GrokGrokipediaTool: openIleExternalLeaveTab(grok|grokipedia)",
        "IleCompactStashWindow: bottom-right always-on-top TAP chrome",
        "TAP does not import ILE blur-share policy",
      ].join("\n"),
    );
  });
});
