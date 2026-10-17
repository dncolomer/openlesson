/**
 * Advertised guest session URLs are Calibrate / Learn / Verify.
 * Legacy /tap/session and /ile/session may still exist as redirects.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildGuestLinkUrl, flowSessionPath } from "@/lib/guest-link-access";
import { buildIleSessionUrl } from "@/lib/ile-link";
import { buildTapScoreSessionUrl } from "@/lib/tap-score";
import { ileSessionMapPath, ileSessionSettingsPath } from "@/lib/ile-session-routes";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-ab7c040d7287/implementer";

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("flow-named session URLs", () => {
  it("share builders advertise calibrate/learn/verify session paths", () => {
    expect(flowSessionPath("tap", "scout")).toBe("/calibrate/session");
    expect(flowSessionPath("tap", "exercise")).toBe("/verify/session");
    expect(flowSessionPath("ile")).toBe("/learn/session");
    expect(buildGuestLinkUrl("https://app.example.com", "tap", "tok", "scout")).toBe(
      "https://app.example.com/calibrate/session/tok",
    );
    expect(buildTapScoreSessionUrl("https://app.example.com", "tok", "scout")).toBe(
      "https://app.example.com/calibrate/session/tok",
    );
    expect(buildIleSessionUrl("https://app.example.com", "tok")).toBe(
      "https://app.example.com/learn/session/tok",
    );
    expect(ileSessionMapPath({ sessionId: "s1", ileToken: "tok" })).toBe("/learn/session/tok");
    expect(ileSessionSettingsPath({ sessionId: "s1", ileToken: "tok" })).toBe(
      "/learn/session/tok/settings",
    );
    expect(buildGuestLinkUrl("https://app.example.com", "tap", "tok", "scout")).not.toContain(
      "/tap/session",
    );
    expect(buildIleSessionUrl("https://app.example.com", "tok")).not.toContain("/ile/session");
  });

  it("ships flow-named App Router pages; legacy session pages redirect", () => {
    expect(existsSync(join(ROOT, "app/calibrate/session/[token]/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "app/verify/session/[token]/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "app/learn/session/[token]/page.tsx"))).toBe(true);
    expect(read("app/tap/session/[token]/page.tsx")).toContain("flowSessionPath");
    expect(read("app/tap/session/[token]/page.tsx")).toContain("redirect");
    expect(read("app/ile/session/[token]/page.tsx")).toContain("/learn/session/");
    expect(read("next.config.ts")).toContain("/learn/session/:token");
    const mw = read("middleware.ts");
    expect(mw).toContain('"/calibrate/session"');
    expect(mw).toContain('"/verify/session"');
    expect(mw).toContain('"/learn/session/"');
  });
});

describe("flow-url evidence", () => {
  it("writes advertised paths", () => {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "flow-urls.log"),
      [
        buildTapScoreSessionUrl("https://uncertain.systems", "abc", "scout"),
        buildIleSessionUrl("https://uncertain.systems", "abc"),
        buildGuestLinkUrl("https://uncertain.systems", "tap", "abc"),
      ].join("\n"),
    );
  });
});
