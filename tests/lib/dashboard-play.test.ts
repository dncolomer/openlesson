import { describe, expect, it } from "vitest";
import { readDashboardSurface, readRepo } from "../helpers/surface-source";
import {
  DASHBOARD_PLAY_CURIOUS_KIND,
  DASHBOARD_PLAY_CURIOUS_PATH,
  curiousPromptUserMessage,
  dashboardPlayHref,
  dashboardPlaySessionMetadata,
  isDashboardPlaySession,
  normalizeDashboardPlayPrompt,
  parseCuriousPrompt,
  parseDashboardPlayKind,
} from "@/lib/dashboard-play";

describe("dashboard play sessions", () => {
  it("parses kinds and builds disposable session metadata", () => {
    expect(parseDashboardPlayKind("learn")).toBe("learn");
    expect(parseDashboardPlayKind("VERIFY")).toBe("verify");
    expect(parseDashboardPlayKind("calibrate")).toBe("calibrate");
    expect(parseDashboardPlayKind("tap")).toBeNull();
    expect(dashboardPlayHref("learn", "abc")).toBe("/session?id=abc");
    expect(dashboardPlayHref("verify", "abc")).toBe("/play/verify?id=abc");
    expect(dashboardPlayHref("calibrate", "abc")).toBe("/play/calibrate?id=abc");
    const meta = dashboardPlaySessionMetadata("verify");
    expect(meta.unsaved_exit).toBe(true);
    expect(meta.disposable).toBe(true);
    expect(meta.play_kind).toBe("verify");
    expect(isDashboardPlaySession(meta)).toBe(true);
    expect(isDashboardPlaySession({ unsaved_exit: true })).toBe(false);
    expect(normalizeDashboardPlayPrompt("  Fourier   series  ")).toBe("Fourier series");
    expect(parseCuriousPrompt('  "Why do tides lag the moon?"  ')).toBe(
      "Why do tides lag the moon?",
    );
    expect(parseCuriousPrompt("Topic: Coral bleaching at night\nmore")).toBe(
      "Coral bleaching at night",
    );
    expect(curiousPromptUserMessage("abc")).toContain("abc");
    expect(DASHBOARD_PLAY_CURIOUS_KIND).toBe("learn");
  });

  it("wires Home play start and play session shells", () => {
    const dash = readDashboardSurface();
    expect(dash).toContain("data-dashboard-play");
    expect(dash).toContain("Quick Work Session");
    expect(dash).not.toContain("Start a session");
    expect(dash).not.toContain("data-dashboard-play-topics");
    expect(dash).not.toContain("pickDashboardPlayTopics");
    expect(dash).toContain("data-dashboard-play-prompt");
    expect(dash).toContain("data-dashboard-play-start");
    expect(dash).toContain("data-dashboard-play-curious");
    expect(dash).toContain("I'm feeling Curious");
    expect(dash).toContain("data-dashboard-home-search");
    expect(dash).toContain("DASHBOARD_PLAY_START_PATH");
    expect(dash).toContain("DASHBOARD_PLAY_CURIOUS_PATH");
    expect(dash).toContain(DASHBOARD_PLAY_CURIOUS_PATH);
    expect(dash).toContain("PlayCalibrateSession");
    expect(readRepo("app/api/play/start/route.ts")).toContain("dashboardPlaySessionMetadata");
    expect(readRepo("app/api/play/curious/route.ts")).toContain("parseCuriousPrompt");
    expect(readRepo("app/api/play/curious/route.ts")).toContain("rejectIfFreeWeeklySessionLimit");
    expect(readRepo("app/api/play/curious/route.ts")).toContain("callXaiText");
    expect(readRepo("app/play/verify/page.tsx")).toContain("localOpening");
    expect(readRepo("app/play/calibrate/page.tsx")).toContain("PlayCalibrateSession");
    expect(readRepo("middleware.ts")).toContain('"/play"');
  });
});
