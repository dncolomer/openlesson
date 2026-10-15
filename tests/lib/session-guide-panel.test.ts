import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SessionGuidePanel } from "@/components/session-view/session-guide-panel";
import { ILE_WORK_CANVAS_COMMANDS } from "@/lib/ile-work-canvas-commands";
import { SESSION_INSTRUCTIONS } from "@/lib/session-instructions";

const ROOT = join(__dirname, "../..");

describe("session guide panel", () => {
  it("lists the canvas commands and keeps each mode's instructions off the action names", () => {
    const html = renderToStaticMarkup(createElement(SessionGuidePanel, { guide: "calibrate" }));
    expect(html).toContain('data-session-guide="calibrate"');
    expect(html).toContain('data-session-guide-tab="commands"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('data-session-guide-tab="instructions"');
    expect(html).toContain(">commands<");
    expect(html).toContain(">instructions<");
    expect(html).toContain("data-session-commands");
    expect(html).not.toContain("data-session-instructions");
    expect(html).toContain("The board is still opening.");
    expect(html).not.toContain("data-ile-canvas-dictate");
    expect(html).not.toContain("data-ile-craft-insight");
    for (const command of ILE_WORK_CANVAS_COMMANDS) {
      expect(html).toContain(`data-session-command="${command.id}"`);
      expect(html).toContain(`>${command.label}<`);
      expect(html).toContain(`data-accelerando-mark="${command.label}"`);
      expect(html).toContain("disabled");
    }
    expect(html).not.toMatch(/\b(Close|Keep|Discard|Insight)\b/);

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
    expect(source).toContain("IleCraftInsightButton");
    expect(source).toContain("data-session-instructions");
    expect(source).not.toContain("py-2.5");
    expect(source).not.toMatch(/text-(red|green|amber|emerald|yellow|blue|orange|rose|lime)-/);

    const provider = readFileSync(join(ROOT, "components/session-view/session-policy-context.tsx"), "utf8");
    expect(provider).toContain("<SessionCommandBridgeProvider>{children}</SessionCommandBridgeProvider>");
    expect(provider).toContain("<SessionPolicyInferLoop");
  });
});
