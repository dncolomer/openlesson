import { describe, expect, it } from "vitest";
import {
  normalizeRedirectUrl,
  normalizeTapLinkMinutes,
  normalizeTapPostSession,
  resolveTapParticipantType,
} from "@/lib/agent-v2/tap-link-config";

describe("tap-link-config", () => {
  it("normalizes minutes within bounds", () => {
    expect(normalizeTapLinkMinutes(45)).toBe(45);
    expect(normalizeTapLinkMinutes(500)).toBe(120);
    expect(normalizeTapLinkMinutes(0)).toBe(1);
    expect(normalizeTapLinkMinutes("30")).toBe(30);
  });

  it("normalizes post session modes", () => {
    expect(normalizeTapPostSession("show_results")).toBe("show_results");
    expect(normalizeTapPostSession("redirect_url")).toBe("redirect_url");
    expect(normalizeTapPostSession("invalid")).toBe("redirect_workspace");
  });

  it("validates redirect URLs", () => {
    expect(normalizeRedirectUrl("https://example.com/thanks")).toBe("https://example.com/thanks");
    expect(normalizeRedirectUrl("ftp://example.com")).toBeNull();
    expect(normalizeRedirectUrl("not-a-url")).toBeNull();
  });

  it("resolves participant types", () => {
    expect(resolveTapParticipantType({ participant_type: "anonymous" })).toBe("anonymous");
    expect(resolveTapParticipantType({ user_id: "user-1" })).toBe("user");
    expect(resolveTapParticipantType({ guest_email: "a@b.com" })).toBe("guest");
    expect(resolveTapParticipantType({})).toBeNull();
  });
});