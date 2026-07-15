import { describe, expect, it } from "vitest";
import { buildTapScoreSessionUrl } from "@/lib/tap-score";

describe("buildTapScoreSessionUrl", () => {
  it("builds a tap session URL without trailing slash on base", () => {
    expect(buildTapScoreSessionUrl("https://uncertain.systems", "token-abc")).toBe(
      "https://uncertain.systems/tap/session/token-abc"
    );
  });

  it("strips trailing slash from base URL", () => {
    expect(buildTapScoreSessionUrl("https://uncertain.systems/", "token-abc")).toBe(
      "https://uncertain.systems/tap/session/token-abc"
    );
  });
});