import { describe, expect, it } from "vitest";
import {
  createInviteToken,
  hashInviteToken,
  inviteTokenStoragePlaceholder,
  isHashedInvitePlaceholder,
} from "@/lib/organization/invite-token";

describe("invite tokens", () => {
  it("creates high-entropy CSPRNG tokens", () => {
    const a = createInviteToken();
    const b = createInviteToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("hashes deterministically and stores placeholder not plaintext", () => {
    const token = createInviteToken();
    const hash = hashInviteToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashInviteToken(token)).toBe(hash);

    const placeholder = inviteTokenStoragePlaceholder(hash);
    expect(isHashedInvitePlaceholder(placeholder)).toBe(true);
    expect(placeholder).not.toBe(token);
    expect(placeholder.includes(token)).toBe(false);
  });
});
