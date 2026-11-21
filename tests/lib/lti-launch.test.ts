import { describe, expect, it } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import {
  LTI_AGS_CLAIM,
  LTI_CONTEXT_CLAIM,
  LTI_CUSTOM_CLAIM,
  LTI_DEPLOYMENT_ID_CLAIM,
  LTI_MESSAGE_RESOURCE_LINK,
  LTI_MESSAGE_TYPE_CLAIM,
  LTI_RESOURCE_LINK_CLAIM,
  LTI_ROLE_LEARNER,
  LTI_ROLES_CLAIM,
  LTI_TARGET_LINK_URI_CLAIM,
  LTI_VERSION,
  LTI_VERSION_CLAIM,
} from "@/lib/lti/claims";
import { verifyLtiIdToken } from "@/lib/lti/launch";
import { generateLtiToolKey } from "@/lib/lti/keys";

async function platformJwt(input: {
  claims?: Record<string, unknown>;
  issuer?: string;
  audience?: string;
  nonce?: string;
  expired?: boolean;
}) {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "platform";
  publicJwk.alg = "RS256";
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    [LTI_MESSAGE_TYPE_CLAIM]: LTI_MESSAGE_RESOURCE_LINK,
    [LTI_VERSION_CLAIM]: LTI_VERSION,
    [LTI_DEPLOYMENT_ID_CLAIM]: "dep-1",
    [LTI_TARGET_LINK_URI_CLAIM]: "https://uncertain.systems/lti/launch",
    [LTI_ROLES_CLAIM]: [LTI_ROLE_LEARNER],
    [LTI_CONTEXT_CLAIM]: { id: "course-1" },
    [LTI_RESOURCE_LINK_CLAIM]: { id: "rl-1" },
    [LTI_CUSTOM_CLAIM]: { flow_token: "flow-tok" },
    [LTI_AGS_CLAIM]: {
      scope: ["https://purl.imsglobal.org/spec/lti-ags/scope/score"],
      lineitems: "https://school.brightspace.com/d2l/api/lti/ags/lineitems",
    },
    nonce: input.nonce ?? "nonce-1",
    ...input.claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "platform", typ: "JWT" })
    .setIssuer(input.issuer ?? "https://school.brightspace.com")
    .setAudience(input.audience ?? "cid")
    .setSubject("user-9")
    .setIssuedAt(now)
    .setExpirationTime(input.expired ? now - 10 : now + 300)
    .sign(privateKey);
  return { jwt, jwks: { keys: [publicJwk] } };
}

describe("verifyLtiIdToken", () => {
  it("accepts a signed resource-link launch", async () => {
    const { jwt, jwks } = await platformJwt({});
    const result = await verifyLtiIdToken({
      idToken: jwt,
      jwks,
      issuer: "https://school.brightspace.com",
      clientId: "cid",
      nonce: "nonce-1",
      deploymentIds: ["dep-1"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.launch.identity).toBe("lti:https://school.brightspace.com:user-9");
    expect(result.launch.target).toEqual({ kind: "flow", flowToken: "flow-tok" });
    expect(result.launch.ags?.lineitems).toContain("lineitems");
  });

  it("rejects expired, wrong audience, wrong issuer, and replayed nonce", async () => {
    const expired = await platformJwt({ expired: true });
    expect(
      (
        await verifyLtiIdToken({
          idToken: expired.jwt,
          jwks: expired.jwks,
          issuer: "https://school.brightspace.com",
          clientId: "cid",
          nonce: "nonce-1",
        })
      ).ok,
    ).toBe(false);

    const aud = await platformJwt({});
    expect(
      (
        await verifyLtiIdToken({
          idToken: aud.jwt,
          jwks: aud.jwks,
          issuer: "https://school.brightspace.com",
          clientId: "other",
          nonce: "nonce-1",
        })
      ).ok,
    ).toBe(false);

    const iss = await platformJwt({});
    expect(
      (
        await verifyLtiIdToken({
          idToken: iss.jwt,
          jwks: iss.jwks,
          issuer: "https://other.example",
          clientId: "cid",
          nonce: "nonce-1",
        })
      ).ok,
    ).toBe(false);

    const nonce = await platformJwt({});
    expect(
      (
        await verifyLtiIdToken({
          idToken: nonce.jwt,
          jwks: nonce.jwks,
          issuer: "https://school.brightspace.com",
          clientId: "cid",
          nonce: "other-nonce",
        })
      ).ok,
    ).toBe(false);
  });

  it("mints a tool JWKS with a kid", async () => {
    const key = await generateLtiToolKey("kid-1");
    expect(key.kid).toBe("kid-1");
    expect(key.publicJwk.kty).toBe("RSA");
  });
});
