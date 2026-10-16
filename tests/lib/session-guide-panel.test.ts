import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SessionGuidePanel } from "@/components/session-view/session-guide-panel";
import { ILE_WORK_CANVAS_COMMANDS } from "@/lib/ile-work-canvas-commands";
import { SESSION_INSTRUCTIONS } from "@/lib/session-instructions";
import { ileCanvasCommandDraft } from "@/lib/ile-work-canvas-commands";
import { sessionHarnessNextLine, SESSION_HARNESS_FALLBACK } from "@/lib/session-harness";

const ROOT = join(__dirname, "../..");

describe("session guide panel", () => {
  it("lists the canvas commands and keeps each mode's instructions off the action names", () => {
    const html = renderToStaticMarkup(createElement(SessionGuidePanel, { guide: "calibrate" }));
    expect(html).toContain('data-session-guide="calibrate"');
    expect(html).not.toContain('data-session-guide-tab="commands"');
    expect(html).not.toContain("data-session-commands");
    expect(html).toContain('data-session-guide-tab="help"');
    expect(html).toContain('data-session-guide-tab="harness"');
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
    expect(learn).toContain("grid-cols-3");
    expect(learn).toContain(">help<");
    expect(learn).toContain("data-session-commands");
    expect(learn).toContain("data-session-board-tools");
    expect(learn).toContain(">board<");
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
    expect(SESSION_INSTRUCTIONS.calibrate).toBe(en.onboardingGuide.scout.step3.body);
    expect(SESSION_INSTRUCTIONS.learn).toContain("Infer");
    expect(SESSION_INSTRUCTIONS.learn).toContain("hidden state you found");
    expect(SESSION_INSTRUCTIONS.learn).not.toMatch(/hidden cause/);
    expect(SESSION_INSTRUCTIONS.verification).toContain("identity you claimed");
    for (const text of Object.values(SESSION_INSTRUCTIONS)) {
      expect(text).not.toMatch(/\b(Close|Keep|Discard|Insight)\b/);
    }

    const source = readFileSync(join(ROOT, "components/session-view/session-guide-panel.tsx"), "utf8");
    expect(source).toContain("IleCanvasDictateButton");
    expect(source).toContain('onAsk={() => bridge.run("check")}');
    expect(source).toContain("IleCraftInsightButton");
    expect(source).toContain("SessionHarnessPanel");
    expect(source).toContain("data-session-instructions");
    expect(source).toContain('data-session-guide-tab="help"');
    expect(source).toContain("grid-cols-3");
    expect(source).toContain("grid-cols-2");
    expect(source).toContain("text-center");
    expect(source).toContain("CommandPlate");
    expect(source).not.toMatch(/text-(red|green|amber|emerald|yellow|blue|orange|rose|lime)-/);

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
  });
});
