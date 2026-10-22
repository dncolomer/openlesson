import { describe, expect, it } from "vitest";
import {
  canAccessWorkspaceEval,
  canInspectOtherSubjects,
  formatEvalSubjectLabel,
  resolveEvalPersistenceClientMode,
  resolveScoreParticipantIds,
} from "@/lib/pow-api/evaluation-subject";
import type { AuthContext } from "@/lib/pow-api/types";

function auth(partial: Partial<AuthContext> = {}): AuthContext {
  return {
    user_id: "user-owner",
    guest_user_id: null,
    organization_id: "org-1",
    is_org_admin: false,
    key_id: "key-1",
    scopes: ["workspaces:read"],
    ...partial,
  };
}

describe("canAccessWorkspaceEval", () => {
  it("allows owner on private workspace", () => {
    expect(
      canAccessWorkspaceEval({
        callerUserId: "owner",
        workspaceOwnerId: "owner",
        isGroup: false,
      }),
    ).toEqual({ allowed: true, isOwner: true });
  });

  it("denies non-owner on private workspace", () => {
    expect(
      canAccessWorkspaceEval({
        callerUserId: "member",
        workspaceOwnerId: "owner",
        isGroup: false,
      }),
    ).toEqual({ allowed: false, isOwner: false });
  });

  it("denies non-owner even when isGroup is set (group mode retired)", () => {
    expect(
      canAccessWorkspaceEval({
        callerUserId: "member",
        workspaceOwnerId: "owner",
        isGroup: true,
      }),
    ).toEqual({ allowed: false, isOwner: false });
  });
});

describe("canInspectOtherSubjects + resolveScoreParticipantIds", () => {
  it("owners and org admins can inspect; members cannot", () => {
    expect(canInspectOtherSubjects({ isWorkspaceOwner: true })).toBe(true);
    expect(canInspectOtherSubjects({ isOrgAdmin: true })).toBe(true);
    expect(canInspectOtherSubjects({})).toBe(false);
  });

  it("non-owner score always targets self even if body has other ids", () => {
    const r = resolveScoreParticipantIds({
      auth: auth({ user_id: "me" }),
      isWorkspaceOwner: false,
      requestedUserId: "other",
      requestedGuestUserId: "g1",
    });
    expect(r.participantUserId).toBeNull();
    expect(r.participantGuestUserId).toBeNull();
    expect(r.subject).toEqual({ user_id: "me" });
  });

  it("owner can target guest UUID for score", () => {
    const r = resolveScoreParticipantIds({
      auth: auth({ user_id: "owner" }),
      isWorkspaceOwner: true,
      requestedGuestUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
    expect(r.participantGuestUserId).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(r.participantUserId).toBeNull();
    expect(r.subject).toEqual({
      guest_user_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
  });

  it("owner can target registered user for score", () => {
    const r = resolveScoreParticipantIds({
      auth: auth({ user_id: "owner" }),
      isWorkspaceOwner: true,
      requestedUserId: "learner-42",
    });
    expect(r.participantUserId).toBe("learner-42");
    expect(r.subject).toEqual({ user_id: "learner-42" });
  });

  it("guest id wins over user id when both requested by owner", () => {
    const r = resolveScoreParticipantIds({
      auth: auth({ user_id: "owner" }),
      isWorkspaceOwner: true,
      requestedUserId: "learner-42",
      requestedGuestUserId: "guest-1",
    });
    expect(r.subject).toEqual({ guest_user_id: "guest-1" });
  });
});

describe("formatEvalSubjectLabel", () => {
  it("distinguishes guest UUIDs from users", () => {
    expect(formatEvalSubjectLabel({ guest_user_id: "abcd1234-ef00" })).toContain("Guest");
    expect(formatEvalSubjectLabel({ user_id: "user-xyz" })).toContain("User");
    expect(formatEvalSubjectLabel({})).toBe("Unknown subject");
  });
});

describe("resolveEvalPersistenceClientMode", () => {
  it("requires privileged client only after access granted", () => {
    expect(resolveEvalPersistenceClientMode({ allowed: true })).toBe("privileged");
    expect(resolveEvalPersistenceClientMode({ allowed: false })).toBe("deny");
  });
});
