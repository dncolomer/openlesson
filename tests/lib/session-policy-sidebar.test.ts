import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionActionsPanel } from "@/components/session-view/session-mark-controls";
import type { SessionPolicyInference } from "@/lib/session-policy-infer";
import type { SessionMarkMode } from "@/lib/session-marks";

const sentence = "Stay with the line you just drew and open the part that is still thin.";
const holdLine = "Stay with the shaded ray and mark the end that is still open.";
const tryLine = "Leave this ray and write the interval that matches it.";

const entries: SessionPolicyInference[] = [
  { action: "hold", confidence: 0.82, label: holdLine },
  { action: "try", confidence: 0.61, label: tryLine },
];

function focus(mode: SessionMarkMode, suggestion: string | null = sentence): string {
  return renderToStaticMarkup(
    createElement(SessionActionsPanel, {
      mode,
      entries,
      suggestion,
    }),
  );
}

describe("inferred policy sidebar", () => {
  it("shows history with confidence on every flow and the rephrased next step only on Learn", () => {
    const learn = focus("learn");
    const calibrate = focus("calibrate");
    const verification = focus("verification");

    for (const html of [learn, calibrate, verification]) {
      expect(html).not.toContain("data-session-mark=");
      expect(html).toContain("data-session-policy-history");
      expect(html).toContain('data-session-policy-inference="hold"');
      expect(html).toContain('data-session-policy-confidence="0.82"');
      expect(html).toContain(holdLine);
      expect(html).toContain("0.82");
      expect(html).not.toMatch(/\b(Close|Keep|Discard|Insight)\b/);
      expect(html.indexOf("0.82")).toBeLessThan(html.indexOf("0.61"));
    }

    expect(learn).toContain('data-session-policy-section="policy"');
    expect(learn).toContain('data-session-policy-section="focus"');
    expect(learn).toContain('data-session-policy-learn-tab="policy"');
    expect(learn).toContain('data-session-policy-learn-tab="focus"');
    expect(learn).toContain(">policy<");
    expect(learn).toContain(">focus<");
    expect(learn).not.toContain(">next<");
    expect(learn).toContain('role="tab"');
    expect(learn.indexOf('data-session-policy-section="policy"')).toBeLessThan(
      learn.indexOf("data-session-policy-history"),
    );
    expect(learn.indexOf("data-session-policy-history")).toBeLessThan(
      learn.indexOf('data-session-policy-section="focus"'),
    );
    const policyTag = learn.slice(
      learn.lastIndexOf("<section", learn.indexOf('data-session-policy-section="policy"')),
      learn.indexOf(">", learn.indexOf('data-session-policy-section="policy"')) + 1,
    );
    expect(policyTag).toContain('class="hidden"');
    const focusTag = learn.slice(
      learn.lastIndexOf("<section", learn.indexOf('data-session-policy-section="focus"')),
      learn.indexOf(">", learn.indexOf('data-session-policy-section="focus"')) + 1,
    );
    expect(focusTag).toContain("flex-1");
    expect(focusTag).not.toContain('class="hidden"');
    expect(learn).toContain("data-session-policy-suggestion");
    expect(learn).toContain("border-white");
    expect(learn).toContain("bg-white");
    const next = learn.slice(learn.indexOf('data-session-policy-section="focus"'));
    expect(next).toContain("data-session-policy-suggestion");
    expect(next).not.toContain("data-session-policy-history");
    const spot = learn.slice(
      learn.indexOf("data-session-policy-suggestion"),
      learn.indexOf("</p>", learn.indexOf("data-session-policy-suggestion")),
    );
    expect(spot).toContain(sentence);
    expect(spot).not.toMatch(/\b(Close|Keep|Discard|Insight)\b/);

    expect(calibrate).not.toContain("<button");
    expect(verification).not.toContain("<button");
    expect(learn).not.toContain("data-session-mark=");
    expect(calibrate).not.toContain("data-session-policy-suggestion");
    expect(calibrate).not.toContain('data-session-policy-section="focus"');
    expect(calibrate).not.toContain('role="tab"');
    expect(verification).not.toContain("data-session-policy-suggestion");
    expect(verification).not.toContain('data-session-policy-section="focus"');
    expect(verification).not.toContain('role="tab"');
    expect(calibrate).not.toContain(sentence);
    expect(verification).not.toContain(sentence);

    const raw = focus("learn", "Insight");
    expect(raw).not.toContain("data-session-policy-suggestion");
    expect(raw).toContain("data-session-policy-history");
    expect(raw).toContain('data-session-policy-section="focus"');

    const panel = readFileSync(
      join(process.cwd(), "components/session-view/session-mark-controls.tsx"),
      "utf8",
    );
    const live = panel.slice(panel.indexOf("export function SessionActionsPanel"));
    expect(live).toContain("useSessionPolicyInferences");
    expect(live).toContain("useSessionPolicySuggestion");
    expect(live).toContain("<SessionPolicyFocusView");
    expect(live).not.toContain("<SessionMarkControls");
  });
});
