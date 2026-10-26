/**
 * Structural contract: TAP private session links end with thank-you only.
 * Drives shipped UI source + i18n — no re-implementation of endSession.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readTapScoreSurface } from "@/tests/helpers/surface-source";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("TAP session link post-session thank-you", () => {
  it("guest links panel is absent", () => {
    expect(existsSync(join(ROOT, "components/WorkspaceGuestLinksPanel.tsx"))).toBe(false);
  });

  it("TapScoreClient privateToken path shows thank-you + explore landing CTA", () => {
    const client = readTapScoreSurface();
    expect(client).toMatch(
      /if \((?:[sh]\.)?privateToken\)[\s\S]{0,280}(?:phase:\s*"results"|setPhase\("results"\))/,
    );
  });

  it("ExerciseTapClient privateToken path matches conversational thank-you + Explore Uncertain Systems", () => {
    expect(existsSync(join(ROOT, "components/ExerciseTapClient.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/exercise-tap"))).toBe(false);

    // Guest private links no longer end on "Run again" only
  });

  it("en i18n has PoW stored thank-you and explore CTA copy", () => {
    const en = JSON.parse(read("messages/en.json")) as {
      tap?: { postSession?: Record<string, string> };
    };
    const post = en.tap?.postSession ?? {};
    expect(post.thankYouTitle?.toLowerCase()).toMatch(/thank you/);
    expect(post.thankYouBody?.toLowerCase()).toMatch(/distance/);
    expect(post.thankYouBody?.toLowerCase()).toMatch(/stored/);
    expect(post.thankYouVerifyBody?.toLowerCase()).toMatch(/thank you/);
    expect(post.thankYouVerifyBody?.toLowerCase()).toMatch(/stored/);
    expect(post.thankYouVerifyBody?.toLowerCase()).not.toMatch(/distance/);
    expect(post.exploreUncertainSystems).toMatch(/Uncertain Systems/i);
    expect(post.backToWorkspace).toMatch(/workspace/i);
    expect(post.backToDashboard).toMatch(/dashboard/i);
    expect(post.scoring).toMatch(/scor/i);
  });
});
