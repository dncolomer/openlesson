import { describe, expect, it } from "vitest";
import {
  isLtiParticipantIdentity,
  ltiDisplayName,
  ltiParticipantIdentity,
  ltiSubjectFromIdentity,
} from "@/lib/lti/identity";

describe("lti identity", () => {
  it("builds a stable identity from issuer and sub", () => {
    expect(ltiParticipantIdentity("https://school.brightspace.com", "user-9")).toBe(
      "lti:https://school.brightspace.com:user-9",
    );
    expect(isLtiParticipantIdentity("lti:https://school.brightspace.com:user-9")).toBe(true);
    expect(isLtiParticipantIdentity("ada")).toBe(false);
    expect(ltiParticipantIdentity("", "user-9")).toBe("");
    expect(
      ltiSubjectFromIdentity("lti:https://school.brightspace.com:user-9", "https://school.brightspace.com"),
    ).toBe("user-9");
    expect(
      ltiSubjectFromIdentity("lti:https://other.example:user-9", "https://school.brightspace.com"),
    ).toBe("");
  });

  it("prefers name then given+family then email", () => {
    expect(ltiDisplayName({ name: "Ada Lovelace", email: "ada@example.com" })).toBe(
      "Ada Lovelace",
    );
    expect(ltiDisplayName({ given_name: "Ada", family_name: "Lovelace" })).toBe("Ada Lovelace");
    expect(ltiDisplayName({ email: "ada@example.com" })).toBe("ada@example.com");
  });
});
