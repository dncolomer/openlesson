import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  decideIleSettingsEnterMap,
  ileSessionMapPath,
  ileSessionSettingsPath,
  ileWelcomeRouteSync,
  isIleSessionSettingsPath,
} from "@/lib/ile-session-routes";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-ac62cc577bd0/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body);
}

describe("ile session settings vs map routes (shipped)", () => {
  it("detects the dedicated settings path and builds map/settings hrefs", () => {
    expect(isIleSessionSettingsPath("/session/settings")).toBe(true);
    expect(isIleSessionSettingsPath("/session/settings/")).toBe(true);
    expect(isIleSessionSettingsPath("/ile/session/tok/settings")).toBe(true);
    expect(isIleSessionSettingsPath("/learn/abc/session/settings")).toBe(true);
    expect(isIleSessionSettingsPath("/session")).toBe(false);
    expect(isIleSessionSettingsPath("/ile/session/tok")).toBe(false);
    expect(isIleSessionSettingsPath("/session?id=x")).toBe(false);

    expect(ileSessionSettingsPath({ sessionId: "s1" })).toBe("/session/settings?id=s1");
    expect(ileSessionMapPath({ sessionId: "s1" })).toBe("/session?id=s1");
    expect(ileSessionSettingsPath({ sessionId: "s1", resume: true })).toBe(
      "/session/settings?id=s1&resume=1",
    );
    expect(ileSessionMapPath({ sessionId: "s1", ileToken: "tok" })).toBe("/ile/session/tok");
    expect(ileSessionSettingsPath({ sessionId: "s1", ileToken: "tok" })).toBe(
      "/ile/session/tok/settings",
    );
    expect(
      ileSessionSettingsPath({ sessionId: "s1", ayclToken: "ay" }),
    ).toBe("/learn/ay/session/settings?id=s1");
    expect(ileSessionMapPath({ sessionId: "s1", ayclToken: "ay" })).toBe(
      "/learn/ay/session?id=s1",
    );

    writeScratch(
      "ile-session-routes.txt",
      [
        `settings=${ileSessionSettingsPath({ sessionId: "s1" })}`,
        `map=${ileSessionMapPath({ sessionId: "s1" })}`,
        `ileSettings=${isIleSessionSettingsPath("/ile/session/tok/settings")}`,
      ].join("\n"),
    );
  });

  it("updates the Welcome address without remounting the screen", () => {
    const settingsHref = ileSessionSettingsPath({ sessionId: "s1" });
    const mapHref = ileSessionMapPath({ sessionId: "s1" });
    expect(
      ileWelcomeRouteSync({
        showWelcome: true,
        browserPath: "/session",
        routerPath: "/session",
        settingsHref,
        mapHref,
      }),
    ).toEqual({ kind: "replace-state", href: settingsHref });
    expect(
      ileWelcomeRouteSync({
        showWelcome: true,
        browserPath: "/session/settings",
        routerPath: "/session/settings",
        settingsHref,
        mapHref,
      }).kind,
    ).toBe("none");
    expect(
      ileWelcomeRouteSync({
        showWelcome: false,
        browserPath: "/ile/session/tok/settings",
        routerPath: "/ile/session/tok",
        settingsHref: "/ile/session/tok/settings",
        mapHref: "/ile/session/tok",
      }),
    ).toEqual({ kind: "replace-state", href: "/ile/session/tok" });
    expect(
      ileWelcomeRouteSync({
        showWelcome: false,
        browserPath: "/session/settings",
        routerPath: "/session/settings",
        settingsHref,
        mapHref,
      }),
    ).toEqual({ kind: "router-replace", href: mapHref });

    const view = readFileSync(join(__dirname, "../../components/SessionView.tsx"), "utf8");
    expect(view).toContain("ileWelcomeRouteSync");
    expect(view).toContain("window.history.replaceState(window.history.state, \"\", sync.href)");
    expect(view).not.toContain("router.replace(ileSessionSettingsPath");
  });

  it("re-arms Help or recording when the map remounts after settings confirm", () => {
    expect(
      decideIleSettingsEnterMap({
        settingsConfirmed: true,
        onSettingsRoute: true,
        welcomeSeen: false,
        recording: false,
      }),
    ).toBe("idle");
    expect(
      decideIleSettingsEnterMap({
        settingsConfirmed: false,
        onSettingsRoute: false,
        welcomeSeen: false,
        recording: false,
      }),
    ).toBe("idle");
    expect(
      decideIleSettingsEnterMap({
        settingsConfirmed: true,
        onSettingsRoute: false,
        welcomeSeen: false,
        recording: false,
      }),
    ).toBe("help");
    expect(
      decideIleSettingsEnterMap({
        settingsConfirmed: true,
        onSettingsRoute: false,
        welcomeSeen: true,
        recording: false,
      }),
    ).toBe("record");
    expect(
      decideIleSettingsEnterMap({
        settingsConfirmed: true,
        onSettingsRoute: false,
        welcomeSeen: true,
        recording: true,
      }),
    ).toBe("idle");

    const view = readFileSync(
      join(__dirname, "../../components/SessionView.tsx"),
      "utf8",
    );
    const phase = readFileSync(
      join(__dirname, "../../components/session-view/use-session-phase.ts"),
      "utf8",
    );
    expect(view).toContain("decideIleSettingsEnterMap");
    expect(view).toContain("mapEntryTailDoneRef");
    expect(view).toContain('action === "help"');
    expect(view).toContain("startRecording()");
    expect(phase).toContain("decideIleSettingsEnterMap");
    expect(phase).toContain('enterMap === "help"');
    expect(phase).toContain('enterMap === "record"');
  });
});
