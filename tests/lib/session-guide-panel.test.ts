import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SessionGuidePanel } from "@/components/session-view/session-guide-panel";
import { ILE_WORK_CANVAS_COMMANDS } from "@/lib/learn-work-canvas-commands";
import { SESSION_BRIEFING_INTRO, SESSION_INSTRUCTIONS } from "@/lib/session-instructions";
import { ileCanvasCommandDraft } from "@/lib/learn-work-canvas-commands";
import {
  sessionHarnessFocusLine,
  sessionHarnessNextLine,
  SESSION_HARNESS_FALLBACK,
} from "@/lib/session-harness";

const ROOT = join(__dirname, "../..");

describe("session guide panel", () => {
  it("lists the canvas commands and keeps each mode's instructions off the action names", () => {
    const html = renderToStaticMarkup(createElement(SessionGuidePanel, { guide: "calibrate" }));
    expect(html).toContain('data-session-guide="calibrate"');
    expect(html).not.toContain('data-session-guide-tab="commands"');
    expect(html).not.toContain("data-session-commands");
    expect(html).toContain('data-session-guide-tab="help"');
    expect(html).toContain('data-session-guide-tab="harness"');
    expect(html.indexOf('data-session-guide-tab="harness"')).toBeLessThan(
      html.indexOf('data-session-guide-tab="help"'),
    );
    expect(html).toContain("data-session-instructions");
    expect(html).toContain(">help<");
    expect(html).toContain(">harness<");
    expect(html).not.toContain(">instructions<");
    expect(html).toContain("grid-cols-2");
    expect(html).not.toContain("The board is still opening.");
    expect(html).not.toContain("data-ile-canvas-dictate");
    expect(html).not.toContain("data-ile-craft-insight");
    for (const command of ILE_WORK_CANVAS_COMMANDS) {
      expect(html).not.toContain(`data-session-command="${command.id}"`);
    }
    expect(html).not.toMatch(/\b(Close|Keep|Discard|Insight)\b/);

    const learn = renderToStaticMarkup(createElement(SessionGuidePanel, { guide: "learn" }));
    expect(learn).toContain('data-session-guide-tab="commands"');
    expect(learn).toContain('data-session-guide-tab="help"');
    expect(learn).toContain('data-session-guide-tab="harness"');
    expect(learn.indexOf('data-session-guide-tab="commands"')).toBeLessThan(
      learn.indexOf('data-session-guide-tab="harness"'),
    );
    expect(learn.indexOf('data-session-guide-tab="harness"')).toBeLessThan(
      learn.indexOf('data-session-guide-tab="help"'),
    );
    expect(learn).toContain("grid-cols-3");
    expect(learn).toContain(">help<");
    expect(learn).toContain("data-session-commands");
    expect(learn).not.toContain("data-session-board-tools");
    expect(learn).not.toContain(">board<");
    expect(learn).toContain('data-session-command="commit"');
    expect(learn).toContain('data-session-command="dictate"');
    expect(learn).toContain("data-ile-craft-insight");
    expect(learn).toContain("data-ile-canvas-dictate");
    expect(learn).toContain("data-session-commit");
    expect(learn).toContain('data-ile-command-index="06"');
    expect(learn).toContain('data-ile-command-index="07"');
    for (const command of ILE_WORK_CANVAS_COMMANDS) {
      expect(learn).toContain(`data-session-command="${command.id}"`);
      expect(learn).toContain(`>${command.label}<`);
      expect(learn).toContain(`data-accelerando-mark="${command.label}"`);
      expect(learn).toContain(`data-ile-command-mark="${command.id}"`);
      expect(learn).toContain("disabled");
    }
    expect(learn).toContain('data-ile-command-index="01"');
    expect(learn).toContain('data-ile-command-index="05"');
    expect(ILE_WORK_CANVAS_COMMANDS.find((command) => command.id === "check")?.label).toBe("Check/ask");

    const en = JSON.parse(readFileSync(join(ROOT, "messages/en.json"), "utf8")) as {
      onboardingGuide: { scout: { step3: { body: string } } };
    };
    expect(SESSION_INSTRUCTIONS.calibrate).not.toBe(en.onboardingGuide.scout.step3.body);
    expect(SESSION_INSTRUCTIONS.calibrate).toMatch(/tap every question/i);
    expect(SESSION_INSTRUCTIONS.calibrate).not.toMatch(/hidden state/i);
    expect(SESSION_INSTRUCTIONS.learn).toContain("commit (insight)");
    expect(SESSION_INSTRUCTIONS.learn).toContain("takeaway");
    expect(SESSION_INSTRUCTIONS.learn).not.toMatch(/hidden state|posterior/i);
    expect(SESSION_INSTRUCTIONS.learn).not.toMatch(/hidden cause/);
    expect(SESSION_INSTRUCTIONS.verification).toContain("Distance");
    expect(SESSION_INSTRUCTIONS.verification).toContain("End session");
    expect(SESSION_INSTRUCTIONS.verification).toMatch(/stored/i);
    expect(SESSION_INSTRUCTIONS.verification).not.toMatch(/generative model|cheapest policy/i);
    for (const text of Object.values(SESSION_INSTRUCTIONS)) {
      expect(text).not.toMatch(/\b(Close|Keep|Discard|Insight)\b/);
    }
    expect(SESSION_BRIEFING_INTRO.calibrate).toMatch(/tap every question/i);
    expect(SESSION_BRIEFING_INTRO.calibrate).not.toMatch(/hidden state|What would you need to settle about/i);
    expect(SESSION_BRIEFING_INTRO.verification).toMatch(/Distance/);
    expect(SESSION_BRIEFING_INTRO.verification).not.toMatch(/hidden state|What would you need to settle about/i);
    for (const text of Object.values(SESSION_BRIEFING_INTRO)) {
      expect(text).not.toMatch(/\$\{|What would you need to settle about|in This region/i);
    }

    const source = readFileSync(join(ROOT, "components/session-view/session-guide-panel.tsx"), "utf8");
    expect(source).toContain("IleCanvasDictateButton");
    expect(source).not.toContain("onAsk=");
    expect(source).toContain("IleCraftInsightButton");
    expect(source).toContain("SessionHarnessPanel");
    expect(source).toContain("data-session-instructions");
    expect(source).toContain('data-session-guide-tab="help"');
    expect(source).toContain("grid-cols-3");
    expect(source).toContain("grid-cols-2");
    expect(source).toContain("text-center");
    expect(source).not.toContain("Commands use the marks selected on the canvas.");
    expect(source).not.toContain("Select marks on the canvas first.");
    expect(learn).not.toContain("Select marks on the canvas first.");
    expect(source).toContain("CommandPlate");
    expect(source).toContain("auto-rows-fr");
    expect(source).toContain("grid-rows-3");
    expect(source).toContain("data-session-commit");
    expect(source).not.toContain("grid-rows-4");
    expect(source).not.toContain("grid-rows-[minmax(0,3fr)_minmax(0,1fr)_auto]");
    expect(source).toContain("data-session-commands");
    expect(source).toContain("overflow-hidden");
    expect(source).not.toMatch(/data-session-commands[^>]*overflow-y-auto/);
    expect(source).not.toMatch(/text-(red|green|amber|emerald|yellow|blue|orange|rose|lime)-/);

    const plates = readFileSync(join(ROOT, "components/excalidraw-canvas/command-plate.tsx"), "utf8");
    expect(plates).toContain("ILE_CANVAS_COMMAND_SIDEBAR_CLASS");
    expect(plates).toContain("ILE_CANVAS_COMMAND_SIDEBAR_COMMIT_CLASS");
    expect(plates).toContain("ILE_CANVAS_COMMAND_SIDEBAR_COMMIT_BAR_CLASS");
    expect(plates).toContain("bg-white");
    expect(plates).toContain("flex-row");
    expect(plates).toContain("h-full min-h-0");
    expect(plates).toContain("[container-type:size]");
    expect(plates).not.toContain("min-h-[4.75rem]");

    const provider = readFileSync(join(ROOT, "components/session-view/session-policy-context.tsx"), "utf8");
    expect(provider).toContain("<SessionCommandBridgeProvider>{children}</SessionCommandBridgeProvider>");
    expect(provider).toContain("<SessionPolicyInferLoop");
  });

  it("keeps /ask as Ask and Check/ask as the check command", () => {
    expect(ileCanvasCommandDraft("/ask what holds").exactId).toBeNull();
    expect(ileCanvasCommandDraft("/ask what holds").rest).toBe("what holds");
    expect(ileCanvasCommandDraft("/check").exactId).toBe("check");
    expect(ileCanvasCommandDraft("/check/ask").exactId).toBe("check");
    expect(ileCanvasCommandDraft("/check-ask").exactId).toBe("check");
  });

  it("writes a contextual Harness next line without action labels", () => {
    expect(
      sessionHarnessNextLine({
        suggestion: "Stay with the ray and mark the end that is still open.",
        inferenceLabel: "Forage",
        fallback: SESSION_HARNESS_FALLBACK.learn,
      }),
    ).toBe("Stay with the ray and mark the end that is still open.");
    expect(
      sessionHarnessNextLine({
        suggestion: "Keep",
        inferenceLabel: "Open the next still on this line.",
        fallback: SESSION_HARNESS_FALLBACK.learn,
      }),
    ).toBe("Open the next still on this line.");
    expect(
      sessionHarnessNextLine({
        suggestion: "Insight",
        inferenceLabel: "Close",
        fallback: SESSION_HARNESS_FALLBACK.calibrate,
      }),
    ).toBe(SESSION_HARNESS_FALLBACK.calibrate);
    for (const text of Object.values(SESSION_HARNESS_FALLBACK)) {
      expect(text).not.toMatch(/\b(Close|Keep|Discard|Insight|Forage|Exploit|Avoid|Infer)\b/);
    }
    expect(SESSION_HARNESS_FALLBACK.calibrate).toMatch(/tap every question/i);
    expect(SESSION_HARNESS_FALLBACK.calibrate).not.toMatch(/hidden state/i);

    const hint = "Stay with the ray and mark the end that is still open.";
    expect(
      sessionHarnessFocusLine({
        guide: "learn",
        suggestion: hint,
        inferenceLabel: "Forage",
      }),
    ).toBe(hint);
    expect(
      sessionHarnessFocusLine({
        guide: "calibrate",
        suggestion: hint,
        inferenceLabel: hint,
      }),
    ).toBe(SESSION_HARNESS_FALLBACK.calibrate);
    expect(
      sessionHarnessFocusLine({
        guide: "verification",
        suggestion: hint,
        inferenceLabel: hint,
      }),
    ).toBe(hint);
    expect(
      sessionHarnessFocusLine({
        guide: "verification",
        suggestion: "Keep",
        inferenceLabel: "Insight",
      }),
    ).toBe(SESSION_HARNESS_FALLBACK.verification);
    const harness = readFileSync(join(ROOT, "components/session-view/session-harness-panel.tsx"), "utf8");
    expect(harness).toContain("sessionHarnessFocusLine");
    expect(harness).toContain("data-session-harness-next");
    expect(harness).not.toContain("SessionBranchFieldMap");
    expect(harness).not.toContain("data-session-branch-field-map");
    expect(harness).not.toContain("SESSION_HARNESS_FALLBACK[guide]");
  });
});
