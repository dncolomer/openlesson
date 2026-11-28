/**
 * Advertised guest session URLs are Learn and Verify.
 * Calibrate product URLs 308 to Verify. Legacy /tap/session and /ile/session may still exist as redirects.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildGuestLinkUrl, flowSessionPath } from "@/lib/guest-link-access";
import { buildTapScoreSessionUrl } from "@/lib/tap-score";
import { tmpdir } from "node:os";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-ab7c040d7287/implementer");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("flow-named session URLs", () => {
  it("share builders advertise verify session paths", () => {
    expect(flowSessionPath("tap", "scout")).toBe("/verify/session");
    expect(flowSessionPath("tap", "exercise")).toBe("/verify/session");
    expect(buildGuestLinkUrl("https://app.example.com", "tap", "tok", "scout")).toBe(
      "https://app.example.com/verify/session/tok",
    );
    expect(buildTapScoreSessionUrl("https://app.example.com", "tok", "scout")).toBe(
      "https://app.example.com/verify/session/tok",
    );
    expect(buildGuestLinkUrl("https://app.example.com", "tap", "tok", "scout")).not.toContain(
      "/tap/session",
    );
  });

  it("ships verify App Router page and redirects legacy /tap/session and /calibrate/session", () => {
    expect(existsSync(join(ROOT, "app/calibrate/session/[token]/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/play/calibrate/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/verify/session/[token]/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "app/learn/session/[token]/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/tap/session/[token]/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/ile/session/[token]/page.tsx"))).toBe(false);
    expect(read("next.config.ts")).toContain("/tap/session/:token");
    expect(read("next.config.ts")).toContain("/calibrate/session/:token");
    expect(read("next.config.ts")).toContain("/verify/session/:token");
    const mw = read("middleware.ts");
    expect(mw).not.toContain('"/calibrate/session"');
    expect(mw).toContain('"/verify/session"');
  });
});

describe("flow-url evidence", () => {
  it("writes advertised paths", () => {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "flow-urls.log"),
      [
        buildTapScoreSessionUrl("https://uncertain.systems", "abc", "scout"),
        buildGuestLinkUrl("https://uncertain.systems", "tap", "abc"),
      ].join("\n"),
    );
  });
});
