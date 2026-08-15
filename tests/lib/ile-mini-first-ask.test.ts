/**
 * First-time ILE mini mode: ask before opening so browsers do not silently block.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  decideIleMiniModeFirstAsk,
  ileMiniModeFirstAskCopy,
  isIleAwayFromTab,
  loadIleMiniModeConsent,
  parseIleMiniModeConsent,
  saveIleMiniModeConsent,
  shouldHonorIleMiniModeHide,
} from "@/lib/ile-blur-screenshare";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-e3f085facba9/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe("decideIleMiniModeFirstAsk (shipped helper)", () => {
  it("never-asked away without Document PiP → hide (button only); Chrome still opens", () => {
    const awayNever = decideIleMiniModeFirstAsk({
      sessionActive: true,
      tabFocused: false,
      leaveReason: "tab_blur",
      consent: "never",
    });
    expect(awayNever).toBe("hide");

    const chromeOwns = decideIleMiniModeFirstAsk({
      sessionActive: true,
      tabFocused: false,
      leaveReason: "tab_blur",
      consent: "never",
      documentPipSupported: true,
    });
    expect(chromeOwns).toBe("open");

    const grokNever = decideIleMiniModeFirstAsk({
      sessionActive: true,
      tabFocused: true,
      leaveReason: "grok",
      consent: "never",
    });
    expect(grokNever).toBe("hide");

    const awayAccepted = decideIleMiniModeFirstAsk({
      sessionActive: true,
      tabFocused: false,
      leaveReason: "tab_hidden",
      consent: "accepted",
    });
    expect(awayAccepted).toBe("hide");

    const awayDeclined = decideIleMiniModeFirstAsk({
      sessionActive: true,
      tabFocused: false,
      leaveReason: "tab_blur",
      consent: "declined",
    });
    expect(awayDeclined).toBe("hide");

    const focused = decideIleMiniModeFirstAsk({
      sessionActive: true,
      tabFocused: true,
      leaveReason: null,
      consent: "accepted",
    });
    expect(focused).toBe("hide");

    const inactive = decideIleMiniModeFirstAsk({
      sessionActive: false,
      tabFocused: false,
      consent: "never",
    });
    expect(inactive).toBe("hide");

    const declinedAway = isIleAwayFromTab({
      tabFocused: false,
      leaveReason: "tab_blur",
    });
    const focusedAway = isIleAwayFromTab({
      tabFocused: true,
      leaveReason: null,
    });
    expect(
      shouldHonorIleMiniModeHide({ first: awayDeclined, away: declinedAway }),
    ).toBe(true);
    expect(shouldHonorIleMiniModeHide({ first: focused, away: focusedAway })).toBe(
      false,
    );
    expect(shouldHonorIleMiniModeHide({ first: awayNever, away: declinedAway })).toBe(
      true,
    );
    expect(
      shouldHonorIleMiniModeHide({ first: awayAccepted, away: declinedAway }),
    ).toBe(true);

    expect(parseIleMiniModeConsent(null)).toBe("never");
    expect(parseIleMiniModeConsent("accepted")).toBe("accepted");
    const storage = memoryStorage();
    expect(loadIleMiniModeConsent(storage)).toBe("never");
    expect(saveIleMiniModeConsent("accepted", storage)).toBe("accepted");
    expect(loadIleMiniModeConsent(storage)).toBe("accepted");

    const copy = ileMiniModeFirstAskCopy();
    expect(copy.title.toLowerCase()).toMatch(/mini mode/);
    expect(copy.body.toLowerCase()).toMatch(/mini window|always-on-top|mini mode/);
    expect(copy.accept.toLowerCase()).toMatch(/enable/);

    writeScratch(
      "ile-mini-first-ask.txt",
      [
        `never_away=${awayNever}`,
        `chrome_pip_never_away=${chromeOwns}`,
        `grok_never=${grokNever}`,
        `accepted_away=${awayAccepted}`,
        `declined_away=${awayDeclined}`,
        `focused=${focused}`,
        `inactive=${inactive}`,
        `honor_declined_away=${shouldHonorIleMiniModeHide({ first: awayDeclined, away: declinedAway })}`,
        `honor_focused_hide=${shouldHonorIleMiniModeHide({ first: focused, away: focusedAway })}`,
        `copy_title=${copy.title}`,
      ].join("\n"),
    );
  });
});

describe("first-time ask wiring", () => {
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
    const popupOpenIdx = applyBody.indexOf("openIleCompactPopupWindow");
    expect(autoIdx).toBeGreaterThan(-1);
    expect(autoIdx).toBeLessThan(popupOpenIdx);
    expect(applyBody).toMatch(/shouldAutoOpenIleMiniOnLeave[\s\S]*return;/);

    expect(view).toContain("showOpenPicInPic={showManualPicInPic}");
    expect(view).toContain("onOpenPicInPic={openManualPicInPic}");

    const labelIdx = tools.indexOf("ILE_OPEN_PIC_IN_PIC_LABEL");
    const helpIdx = tools.indexOf('bottomTools.map');
    expect(labelIdx).toBeGreaterThan(-1);
    expect(labelIdx).toBeLessThan(helpIdx);

    writeScratch(
      "ile-mini-first-ask-excerpts.txt",
      [
        "decideIleMiniModeFirstAsk: no Document PiP → hide (no first-leave ask)",
        "useIleBlurScreenshare: leave skips auto-open; openManualPicInPic is the gesture",
        "ToolsPanel: open pic-in-pic sits above Help",
      ].join("\n"),
    );
  });
});
