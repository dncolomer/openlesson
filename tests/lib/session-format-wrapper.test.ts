import { describe, expect, it } from "vitest";
import {
  stripCommandMetaWrapper,
  stripLearnerFacingWrappers,
  stripSessionFormatWrapper,
} from "@/lib/session-format-wrapper";
import {
  applyIleXaiTurnToWorkCanvas,
  emptyIleWorkCanvasScene,
  parseIleXaiCanvasTurn,
} from "@/lib/ile-work-canvas";

describe("learner-facing wrappers", () => {
  it("strips Check/ask placement chatter and leaves a direct answer", () => {
    expect(
      stripCommandMetaWrapper(
        "Your question sits in the right place (After Check/Ask). Last resort requires exhausting peaceful means first.",
      ),
    ).toBe("Last resort requires exhausting peaceful means first.");
    expect(
      stripLearnerFacingWrappers("Your question sits in the right place (After Check/Ask)."),
    ).toBe("");
    expect(stripLearnerFacingWrappers("plain prose reply with no JSON")).toBe(
      "plain prose reply with no JSON",
    );
    expect(
      stripLearnerFacingWrappers(
        "Your question sits in the right place (After Check/Ask). last resort requires exhausting peaceful means first.",
      ),
    ).toBe("Last resort requires exhausting peaceful means first.");
    expect(stripSessionFormatWrapper("plain prose reply with no JSON")).toBe(
      "plain prose reply with no JSON",
    );
    const parsed = parseIleXaiCanvasTurn("plain prose reply with no JSON");
    expect(parsed.text).toBe("plain prose reply with no JSON");
    const stacked = applyIleXaiTurnToWorkCanvas(emptyIleWorkCanvasScene(), parsed);
    expect(
      stacked.elements.some(
        (el) => (el.originalText || el.text) === "plain prose reply with no JSON",
      ),
    ).toBe(true);
  });
});
