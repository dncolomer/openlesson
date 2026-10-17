import { describe, expect, it } from "vitest";
import { readDashboardSurface, readRepo } from "../helpers/surface-source";
import {
  DASHBOARD_PLAY_TOPIC_POOL,
  dashboardPlayHref,
  dashboardPlaySessionMetadata,
  isDashboardPlaySession,
  normalizeDashboardPlayPrompt,
  parseDashboardPlayKind,
  pickDashboardPlayTopics,
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
  });

  it("samples suggested topics from different disciplines", () => {
    const seq = [0.1, 0.8, 0.3, 0.9, 0.2, 0.4, 0.7, 0.05, 0.6, 0.5];
    let i = 0;
    const picked = pickDashboardPlayTopics(4, () => seq[i++] ?? 0.1);
    expect(picked).toHaveLength(4);
    const disciplines = picked.map((row) => row.discipline);
    expect(new Set(disciplines).size).toBe(4);
    expect(
      picked.every((row) =>
        DASHBOARD_PLAY_TOPIC_POOL.some(
          (item) => item.discipline === row.discipline && item.prompt === row.prompt,
        ),
      ),
    ).toBe(true);
  });

  it("wires Home play start and play session shells", () => {
    const dash = readDashboardSurface();
    expect(dash).toContain("data-dashboard-play");
    expect(dash).toContain("Quick Session");
    expect(dash).not.toContain("Start a session");
    expect(dash).toContain("data-dashboard-play-start");
    expect(dash).toContain("DASHBOARD_PLAY_START_PATH");
    expect(dash).toContain("PlayCalibrateSession");
    expect(readRepo("app/api/play/start/route.ts")).toContain("dashboardPlaySessionMetadata");
    expect(readRepo("app/play/verify/page.tsx")).toContain("localOpening");
    expect(readRepo("app/play/calibrate/page.tsx")).toContain("PlayCalibrateSession");
    expect(readRepo("middleware.ts")).toContain('"/play"');
  });
});
