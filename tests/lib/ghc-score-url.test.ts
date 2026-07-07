import { describe, expect, it } from "vitest";
import { buildGhlScoreSessionUrl } from "@/lib/ghc-score";

describe("buildGhlScoreSessionUrl", () => {
  it("builds bearer TAP session urls", () => {
    expect(buildGhlScoreSessionUrl("https://openlesson.academy", "token-abc")).toBe(
      "https://openlesson.academy/ghl-score/session/token-abc"
    );
  });

  it("strips trailing slashes from the base url", () => {
    expect(buildGhlScoreSessionUrl("https://openlesson.academy/", "token-abc")).toBe(
      "https://openlesson.academy/ghl-score/session/token-abc"
    );
  });
});