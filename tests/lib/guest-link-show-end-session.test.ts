/**
 * Guest TAP/ILE links: configurable End Session button (default yes).
 * Drives shipped normalize helpers + UI gate wiring.
 */
import { describe, expect, it } from "vitest";
import { readSessionViewSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeShowEndSession,
  resolveShowEndSessionFromBody,
} from "@/lib/pow-api/tap-link-config";
import { resolveTapShowEndSession } from "@/components/TapScoreClient";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("normalizeShowEndSession / resolveShowEndSessionFromBody", () => {
  it("defaults to yes (true) when omitted", () => {
    expect(normalizeShowEndSession(undefined)).toBe(true);
    expect(normalizeShowEndSession(null)).toBe(true);
    expect(normalizeShowEndSession("")).toBe(true);
    expect(resolveShowEndSessionFromBody({})).toBe(true);
  });

  it("accepts explicit true / false (and string aliases)", () => {
    expect(normalizeShowEndSession(true)).toBe(true);
    expect(normalizeShowEndSession(false)).toBe(false);
    expect(normalizeShowEndSession("true")).toBe(true);
    expect(normalizeShowEndSession("false")).toBe(false);
    expect(normalizeShowEndSession("no")).toBe(false);
    expect(normalizeShowEndSession("yes")).toBe(true);
    expect(resolveShowEndSessionFromBody({ show_end_session: false })).toBe(false);
    expect(resolveShowEndSessionFromBody({ showEndSession: true })).toBe(true);
    expect(resolveShowEndSessionFromBody({ allow_end_session: false })).toBe(false);
    expect(resolveShowEndSessionFromBody({ allowEndSession: "off" })).toBe(false);
  });
});

describe("create TAP/ILE link wiring", () => {
  it("create modules persist show_end_session from body and select the field", () => {
    const tap = read("lib/pow-api/create-tap-link.ts");
    const ile = read("lib/pow-api/create-ile-link.ts");
    for (const src of [tap, ile]) {
      expect(src).toContain("resolveShowEndSessionFromBody");
      expect(src).toContain("show_end_session");
      expect(src).toContain("showEndSession");
    }
    // insert payload uses resolved flag
    expect(tap).toMatch(/show_end_session:\s*showEndSession/);
    expect(ile).toMatch(/show_end_session:\s*showEndSession/);
  });

  it("list routes return show_end_session", () => {
    expect(read("app/api/workspace/tap-links/route.ts")).toContain("show_end_session");
    expect(read("app/api/workspace/ile-links/route.ts")).toContain("show_end_session");
    expect(read("app/api/v3/pow/workspaces/[id]/tap-links/route.ts")).toContain(
      "show_end_session",
    );
  });

  it("migration adds show_end_session default true", () => {
    const mig = read("supabase/migrations/20260724130000_guest_link_show_end_session.sql");
    expect(mig).toContain("show_end_session");
    expect(mig).toContain("default true");
    expect(mig).toContain("workspace_tap_sessions");
    expect(mig).toContain("workspace_ile_links");
  });
});

describe("TAP UI gate", () => {
  it("resolveTapShowEndSession defaults true and respects props/initialSession", () => {
    expect(resolveTapShowEndSession({})).toBe(true);
    expect(resolveTapShowEndSession({ showEndSession: true })).toBe(true);
    expect(resolveTapShowEndSession({ showEndSession: false })).toBe(false);
    expect(
      resolveTapShowEndSession({ initialSession: { show_end_session: false } }),
    ).toBe(false);
    expect(
      resolveTapShowEndSession({
        showEndSession: true,
        initialSession: { show_end_session: false },
      }),
    ).toBe(true);
  });

  it("TapScoreClient gates End session button on showEndSession", () => {
    const client = readTapScoreSurface();
    expect(client).toContain("resolveTapShowEndSession");
    expect(client).toContain("data-tap-end-session");
    expect(client).toMatch(/showEndSession\s*\?\s*\([\s\S]*End session/);
    expect(client).toContain("End session");
  });

  it("TAP session page passes show_end_session into TapScoreClient", () => {
    const page = read("app/tap/session/[token]/page.tsx");
    expect(page).toContain("show_end_session");
    expect(page).toContain("showEndSession");
  });
});

describe("ILE UI gate", () => {
  it("resolveIleLinkAccess exposes showEndSession; session page passes it", () => {
    const auth = read("lib/ile-link-auth.ts");
    expect(auth).toContain("showEndSession");
    expect(auth).toContain("show_end_session");
    const page = read("app/ile/session/[token]/page.tsx");
    expect(page).toContain("showEndSession={access.showEndSession}");
    const guest = read("components/IleGuestSessionClient.tsx");
    expect(guest).toContain("showEndSession");
    expect(guest).toContain("SessionView");
  });

  it("SessionView and SessionControlBar hide end controls when showEndSession is false", () => {
    const view = readSessionViewSurface();
    expect(view).toContain("showEndSession");
    expect(view).toContain("allowEndSession");
    expect(view).toMatch(/allowEndSession\s*\?\s*\([\s\S]*ConfirmDialog/);
    expect(view).toMatch(/allowEndSession\s*\?\s*t\('sessionEnd\.returnToWorkspace'\)/);

    const bar = read("components/SessionControlBar.tsx");
    expect(bar).toContain("showEndSession");
    expect(bar).toContain("data-session-end-control");
    expect(bar).toMatch(/showEndSession\s*\?\s*\([\s\S]*sessionEnd\.endSession/);
  });
});
