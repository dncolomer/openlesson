import { describe, expect, it } from "vitest";
import { readSessionViewSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";
import fs from "fs";
import path from "path";
import {
  assertGuestDoesNotOwnUserId,
  buildPowParticipantIdentity,
  powAttributionColumns,
  resolveGuestLinkAttribution,
  resolveMapSessionAttribution,
} from "@/lib/session-participant-identity";
import { participantAuthFromSession } from "@/lib/tap-score-session-auth";

const ROOT = process.cwd();

describe("session-participant-identity", () => {
  it("guest links never fall back to owner", () => {
    expect(resolveGuestLinkAttribution({ guestUserId: "g1", assignedUserId: null })).toEqual({
      userId: null,
      guestUserId: "g1",
    });
    expect(resolveGuestLinkAttribution({ guestUserId: null, assignedUserId: "u1" })).toEqual({
      userId: "u1",
      guestUserId: null,
    });
    // Missing guest — no owner fallback
    expect(resolveGuestLinkAttribution({ guestUserId: null, assignedUserId: null })).toEqual({
      userId: null,
      guestUserId: null,
    });
  });

  it("map sessions attribute to signed-in user only", () => {
    expect(resolveMapSessionAttribution("member-1")).toEqual({
      userId: "member-1",
      guestUserId: null,
    });
  });

  it("powAttributionColumns never dual-stamps guest with user_id", () => {
    const guest = buildPowParticipantIdentity({ guestUserId: "g-abc" });
    expect(powAttributionColumns(guest)).toEqual({ user_id: null, guest_user_id: "g-abc" });
    expect(
      assertGuestDoesNotOwnUserId({ user_id: "owner", guest_user_id: "g1" }),
    ).toEqual({ user_id: null, guest_user_id: "g1" });
  });

  it("participantAuthFromSession does not use workspace owner when guest missing", () => {
    const p = participantAuthFromSession({
      user_id: "owner",
      guest_user_id: null,
      assigned_user_id: null,
      workspaces: { user_id: "owner" },
    });
    expect(p).toEqual({ userId: null, guestUserId: null, assignedUserId: null });
  });
});

describe("guest-link + map attribution wiring", () => {
  it("ILE guest PoW access uses guest auth not owner user_id", () => {
    const access = fs.readFileSync(
      path.join(ROOT, "lib/pow-api/workspace-session-access.ts"),
      "utf8",
    );
    expect(access).toContain('key_id: "ile-link"');
    expect(access).toContain("participantGuestUserId");
    expect(access).toContain("user_id: participantUserId");
    expect(access).toContain("guest_user_id: participantGuestUserId");
    // Must not set auth.user_id to owner on guest links
    expect(access).not.toMatch(/key_id: "ile-link"[\s\S]{0,200}user_id: ile\.ownerUserId/);
  });

  it("TAP/ILE speech inserts force null user_id when guest present", () => {
    for (const rel of [
      "app/api/workspace-tap-score/trace/route.ts",
      "app/api/workspace-tap-score/speech/route.ts",
      "app/api/workspace-ile/speech/route.ts",
      "app/api/workspace-ile/idle/route.ts",
    ]) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      expect(src, rel).toMatch(/guestUserId \? null|guest_user_id \? null/);
    }
  });

  it("TAP and ILE UIs render identity badge", () => {
    const tap = readTapScoreSurface();
    const ile = readSessionViewSurface();
    const badge = fs.readFileSync(path.join(ROOT, "components/SessionIdentityBadge.tsx"), "utf8");
    expect(badge).toContain("data-session-identity-badge");
    expect(tap).toContain("SessionIdentityBadge");
    expect(ile).toContain("participantIdentity={participantIdentity}");
    const chrome = fs.readFileSync(path.join(ROOT, "components/session-view/session-chrome.tsx"), "utf8");
    expect(chrome).not.toContain("SessionIdentityBadge");
    const helios = fs.readFileSync(path.join(ROOT, "components/SessionHeliosPanel.tsx"), "utf8");
    expect(helios).toContain("SessionIdentityBadge");
  });
});
