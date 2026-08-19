/**
 * Structural contract: TAP private session links end with thank-you only.
 * Drives shipped UI source + i18n — no re-implementation of endSession.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readExerciseTapSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("TAP session link post-session thank-you", () => {
  it("guest links UI does not offer after-session action selectors", () => {
    const panel = read("components/WorkspaceGuestLinksPanel.tsx");
    expect(panel).not.toContain("tapLinksPostSession");
    expect(panel).not.toContain("setPostSession");
    expect(panel).not.toContain("redirect_workspace");
    expect(panel).not.toContain("redirect_url");
    // Still creates links with a fixed post_session default for DB compatibility.
    expect(panel).toContain('post_session: "show_results"');
  });

  it("TapScoreClient privateToken path shows thank-you + explore landing CTA", () => {
    const client = readTapScoreSurface();
    expect(client).toContain("privateToken");
    expect(client).toContain("data-tap-session-thank-you");
    expect(client).toContain("data-tap-explore-uncertain-systems");
    expect(client).toContain('href="/"');
    expect(client).toContain("thankYouTitle");
    expect(client).toContain("thankYouBody");
    expect(client).toContain("exploreUncertainSystems");
    // Link sessions short-circuit before workspace redirect.
    expect(client).toMatch(
      /if \((?:[sh]\.)?privateToken\)[\s\S]{0,280}(?:phase:\s*"results"|setPhase\("results"\))/,
    );
  });

  it("ExerciseTapClient privateToken path matches conversational thank-you + Explore Uncertain Systems", () => {
    const client = readExerciseTapSurface();
    expect(client).toContain("privateToken");
    expect(client).toContain("data-tap-session-thank-you");
    expect(client).toContain("data-tap-explore-uncertain-systems");
    expect(client).toContain('href="/"');
    expect(client).toContain("exploreUncertainSystems");
    expect(client).toContain("thankYouTitle");
    expect(client).toContain("thankYouBody");
    // Guest private links no longer end on "Run again" only
    expect(client).not.toMatch(/privateToken \? "Run again"/);
  });

  it("en i18n has PoW stored thank-you and explore CTA copy", () => {
    const en = JSON.parse(read("messages/en.json")) as {
      tap?: { postSession?: Record<string, string> };
    };
    const post = en.tap?.postSession ?? {};
    expect(post.thankYouTitle?.toLowerCase()).toMatch(/thank you/);
    expect(post.thankYouBody?.toLowerCase()).toMatch(/proof of work/);
    expect(post.thankYouBody?.toLowerCase()).toMatch(/stored/);
    expect(post.exploreUncertainSystems).toMatch(/Uncertain Systems/i);
  });
});
