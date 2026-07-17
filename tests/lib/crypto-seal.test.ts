import { afterEach, describe, expect, it } from "vitest";
import { openSealedString, resolveSealSecrets, sealString } from "@/lib/crypto/seal";

describe("sealString / openSealedString", () => {
  const prevDedicated = process.env.XAI_ORG_KEY_ENCRYPTION_SECRET;
  const prevOrg = process.env.ORG_SECRETS_ENCRYPTION_KEY;
  const prevService = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    if (prevDedicated === undefined) delete process.env.XAI_ORG_KEY_ENCRYPTION_SECRET;
    else process.env.XAI_ORG_KEY_ENCRYPTION_SECRET = prevDedicated;
    if (prevOrg === undefined) delete process.env.ORG_SECRETS_ENCRYPTION_KEY;
    else process.env.ORG_SECRETS_ENCRYPTION_KEY = prevOrg;
    if (prevService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevService;
  });

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

  it("prefers dedicated secret over service role for sealing", () => {
    process.env.XAI_ORG_KEY_ENCRYPTION_SECRET = "dedicated-secret-value";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-value";
    const secrets = resolveSealSecrets();
    expect(secrets[0]).toBe("dedicated-secret-value");
    expect(secrets).toContain("service-role-key-value");

    const sealed = sealString("payload");
    // Sealed with dedicated; opens with dedicated without needing service role first
    expect(openSealedString(sealed, "dedicated-secret-value")).toBe("payload");
  });

  it("opens legacy payloads sealed with service-role fallback when dedicated fails", () => {
    process.env.XAI_ORG_KEY_ENCRYPTION_SECRET = "new-dedicated";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role";
    const legacy = sealString("old-payload", "legacy-service-role");
    expect(openSealedString(legacy)).toBe("old-payload");
  });
});
