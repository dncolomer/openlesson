import { describe, expect, it } from "vitest";
import { buildTapScoreSessionUrl } from "@/lib/tap-score";

describe("buildTapScoreSessionUrl", () => {
  it("builds a Verify session URL for leftover scout kind without trailing slash on base", () => {
    expect(buildTapScoreSessionUrl("https://uncertain.systems", "token-abc", "scout")).toBe(
      "https://uncertain.systems/verify/session/token-abc"
    );
  });

  it("builds a Verify session URL by default and strips trailing slash", () => {
    expect(buildTapScoreSessionUrl("https://uncertain.systems/", "token-abc")).toBe(
      "https://uncertain.systems/verify/session/token-abc"
    );
  });
});