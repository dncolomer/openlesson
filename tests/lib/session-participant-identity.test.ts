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

describe("guest-link attribution wiring", () => {
  it("Verify speech inserts force null user_id when guest present", () => {
    const auth = fs.readFileSync(
      path.join(ROOT, "lib/tap-score-session-auth.ts"),
      "utf8",
    );
    expect(auth).toContain("user_id: access.guestUserId ? null : access.userId");
    const trace = fs.readFileSync(
      path.join(ROOT, "app/api/verify/session/trace/route.ts"),
      "utf8",
    );
    expect(trace).toContain("authContextFromTapAccess");
    const tapSpeech = fs.readFileSync(
      path.join(ROOT, "app/api/verify/session/speech/route.ts"),
      "utf8",
    );
    expect(tapSpeech).toMatch(/guestUserId \? null/);
  });
});
