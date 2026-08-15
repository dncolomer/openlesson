/**
 * ILE mini auto-open: leave decision is only open | hide. First-ask is gone.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  decideIleMiniAutoOpen,
  isIleAwayFromTab,
  shouldHonorIleMiniHide,
} from "@/lib/ile-blur-screenshare";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-605d3ab12c6a/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("decideIleMiniAutoOpen (shipped helper)", () => {
  it("Document PiP missing/chrome-owned/focused/away stay open|hide; first-ask surface is gone", () => {
    const missingPip = decideIleMiniAutoOpen({
      sessionActive: true,
      tabFocused: false,
      leaveReason: "tab_blur",
    });
    expect(missingPip).toBe("hide");

    const chromeOwns = decideIleMiniAutoOpen({
      sessionActive: true,
      tabFocused: false,
      leaveReason: "tab_blur",
      documentPipSupported: true,
    });
    expect(chromeOwns).toBe("open");

    const grokAway = decideIleMiniAutoOpen({
      sessionActive: true,
      tabFocused: true,
      leaveReason: "grok",
      documentPipSupported: true,
    });
    expect(grokAway).toBe("open");

    const focused = decideIleMiniAutoOpen({
      sessionActive: true,
      tabFocused: true,
      leaveReason: null,
      documentPipSupported: true,
    });
    expect(focused).toBe("hide");

    const inactive = decideIleMiniAutoOpen({
      sessionActive: false,
      tabFocused: false,
      documentPipSupported: true,
    });
    expect(inactive).toBe("hide");

    const away = isIleAwayFromTab({
      tabFocused: false,
      leaveReason: "tab_blur",
    });
    const onTab = isIleAwayFromTab({
      tabFocused: true,
      leaveReason: null,
    });
    expect(shouldHonorIleMiniHide({ decision: missingPip, away })).toBe(true);
    expect(shouldHonorIleMiniHide({ decision: focused, away: onTab })).toBe(false);
    expect(shouldHonorIleMiniHide({ decision: chromeOwns, away })).toBe(false);

    const blur = read("lib/ile-blur-screenshare.ts");
    const hook = read("lib/useIleBlurScreenshare.tsx");
    const view = read("components/SessionView.tsx");
    expect(blur).toContain("decideIleMiniAutoOpen");
    expect(blur).not.toContain("IleMiniModeFirstAsk");
    expect(blur).not.toContain("ileMiniModeFirstAskCopy");
    expect(blur).not.toContain("ILE_MINI_MODE_CONSENT_STORAGE_KEY");
    expect(blur).not.toContain("loadIleMiniModeConsent");
    expect(blur).not.toContain("saveIleMiniModeConsent");
    expect(blur).not.toContain("runIleLeaveFocusSequence");
    expect(hook).toContain("decideIleMiniAutoOpen");
    expect(hook).not.toContain("decideIleMiniModeFirstAsk");
    expect(hook).not.toContain("miniFirstAskVisible");
    expect(hook).not.toContain("runIleLeaveFocusSequence");
    expect(view).not.toContain("IleMiniModeFirstAsk");
    expect(view).not.toContain("miniFirstAskVisible");
    expect(view).not.toContain("uploadThoughtChatExchange");
    expect(existsSync(join(ROOT, "components/IleMiniModeFirstAsk.tsx"))).toBe(false);

    writeScratch(
      "ile-dead-surface-tests.log",
      [
        `missingPip=${missingPip}`,
        `chromeOwns=${chromeOwns}`,
        `grokAway=${grokAway}`,
        `focused=${focused}`,
        `inactive=${inactive}`,
        "first-ask component/consent/copy/sequence absent",
        "SessionView has no thought-chat-exchange persist option",
      ].join("\n"),
    );
  });
});

describe("mini auto-open wiring", () => {
  it("no-PiP leave does not first-ask; button is the only popup trigger", () => {
    const hook = read("lib/useIleBlurScreenshare.tsx");
    const view = read("components/SessionView.tsx");
    const tools = read("components/ToolsPanel.tsx");

    expect(hook).toContain("shouldAutoOpenIleMiniOnLeave");
    expect(hook).toContain("openManualPicInPic");
    expect(hook).toContain("shouldKeepIleManualPopupOnReturn");
    expect(hook).toContain("openCompactFromGesture");
    expect(hook).toContain("registerIleEnterPictureInPictureHandler");
    expect(hook).toContain("openIleDocumentPictureInPictureWindow");
    const applyStart = hook.indexOf("const applyDecision");
    const applyEnd = hook.indexOf("const openCompactFromGesture");
    expect(applyStart).toBeGreaterThan(-1);
    expect(applyEnd).toBeGreaterThan(applyStart);
    const applyBody = hook.slice(applyStart, applyEnd);
    const autoIdx = applyBody.indexOf("shouldAutoOpenIleMiniOnLeave");
    expect(autoIdx).toBeGreaterThan(-1);
    expect(applyBody).not.toContain("openIleCompactPopupWindow");
    expect(applyBody).not.toContain("shouldRequestIlePopupOnLeave");
    expect(applyBody).toMatch(/shouldAutoOpenIleMiniOnLeave[\s\S]*return;/);

    expect(view).toContain("showOpenPicInPic={showManualPicInPic}");
    expect(view).toContain("onOpenPicInPic={openManualPicInPic}");
    expect(view).not.toContain("IleMiniModeFirstAsk");
    expect(view).not.toContain("miniFirstAskVisible");

    const labelIdx = tools.indexOf("ILE_OPEN_PIC_IN_PIC_LABEL");
    const helpIdx = tools.indexOf("bottomTools.map");
    expect(labelIdx).toBeGreaterThan(-1);
    expect(labelIdx).toBeLessThan(helpIdx);

    writeScratch(
      "ile-mini-first-ask-excerpts.txt",
      [
        "decideIleMiniAutoOpen: no Document PiP → hide (no first-leave ask)",
        "useIleBlurScreenshare: leave skips auto-open; openManualPicInPic is the gesture",
        "ToolsPanel: open pic-in-pic sits above Help",
      ].join("\n"),
    );
  });
});
