import { describe, expect, it } from "vitest";
import { openSealedString, sealString } from "@/lib/crypto/seal";

describe("sealString / openSealedString", () => {
  it("round-trips secrets", () => {
    const secret = "test-encryption-secret-for-unit-tests";
    const plaintext = "xai-api-key-super-secret-value";
    const sealed = sealString(plaintext, secret);
    expect(sealed).not.toContain(plaintext);
    expect(openSealedString(sealed, secret)).toBe(plaintext);
  });

  it("fails open with wrong secret", () => {
    const sealed = sealString("payload", "secret-a");
    expect(() => openSealedString(sealed, "secret-b")).toThrow();
  });
});
