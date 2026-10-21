import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SessionStageProgress } from "@/components/session-view/session-stage-progress";
import {
  FLOW_END_KICKERS,
  sessionLearnPolicyProgressLabel,
  sessionStageProgressLine,
} from "@/lib/session-stage-progress";
import {
  normalizeSessionBranchModel,
  type SessionBranchDraft,
} from "@/lib/session-branch-model";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("session stage progress", () => {
  it("uses 01 plus pass, cheapest policy, or remaining time", () => {
    expect(sessionStageProgressLine({ kind: "calibrate", pass: 1, passes: 2 })).toEqual({
      index: "01",
      label: "Pass 1 of 2",
    });
    expect(sessionStageProgressLine({ kind: "learn", policyLabel: "Policy · Forage" })).toEqual({
      index: "01",
      label: "Policy · Forage",
    });
    expect(sessionStageProgressLine({ kind: "verify", remainingSeconds: 760 })).toEqual({
      index: "01",
      label: "12:40",
    });
    const html = renderToStaticMarkup(
      createElement(SessionStageProgress, { kind: "calibrate", label: "Pass 1 of 2" }),
    );
    expect(html).toContain('data-session-stage-progress=""');
    expect(html).toContain('data-session-stage-kind="calibrate"');
    expect(html).toContain(">01<");
    expect(html).toContain("Pass 1 of 2");
  });

  it("names the cheapest live action on Learn", () => {
    const draft: SessionBranchDraft = {
      premise: "Just war",
      closePrice: 28,
      keepPrice: 4,
      discardPrice: 40,
      insightPrice: 90,
      regions: [
        {
          title: "Region 1",
          territory: "Territory 1",
          observation: "Region 1 is open.",
          closePrice: 28,
          keepPrice: 4,
          discardPrice: 40,
          insightPrice: 90,
        },
      ],
    };
    const model = normalizeSessionBranchModel(draft, "Just war");
    expect(model).toBeTruthy();
    if (!model) return;
    expect(sessionLearnPolicyProgressLabel(model)).toBe("Policy · Forage");
  });

  it("shares Calibrate / Learn / Verify kickers on the finished plates", () => {
    expect(FLOW_END_KICKERS).toEqual({
      calibrate: "Calibrate",
      learn: "Learn",
      verify: "Verify",
    });
    expect(read("components/session-view/learn-insight-kept-screen.tsx")).toContain(
      "FLOW_END_KICKERS.learn",
    );
    expect(read("components/scout-tap/scout-tap-phases.tsx")).toContain("FLOW_END_KICKERS.calibrate");
    expect(read("components/CalibrationFlowRunner.tsx")).toContain("FLOW_END_KICKERS.calibrate");
    expect(read("components/tap-score/tap-score-phases.tsx")).toContain("FLOW_END_KICKERS.verify");
    expect(read("components/session-view/session-chrome.tsx")).not.toContain("SessionStageHud");
    expect(read("components/tap-score/tap-score-phases.tsx")).not.toContain("SessionStageHud");
    expect(read("components/session-view/session-guide-panel.tsx")).toContain("SessionHarnessPanel");
    expect(read("components/calibrate/calibrate-sounding-surface.tsx")).not.toContain(
      "SessionBranchFieldMap",
    );
  });
});
