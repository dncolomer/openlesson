import { describe, expect, it } from "vitest";
import {
  buildPlatformAuthRedirect,
  newOidcState,
  oidcStateIsFresh,
  parseLoginInitiation,
} from "@/lib/lti/oidc";

describe("lti oidc", () => {
  it("parses Brightspace login initiation fields", () => {
    const parsed = parseLoginInitiation({
      iss: "https://school.brightspace.com",
      login_hint: "hint",
      target_link_uri: "https://uncertain.systems/lti/launch",
      client_id: "cid",
      lti_message_hint: "mh",
      lti_deployment_id: "dep-1",
    });
    expect(parsed).toMatchObject({
      iss: "https://school.brightspace.com",
      clientId: "cid",
      ltiDeploymentId: "dep-1",
    });
    expect(parseLoginInitiation({})).toEqual({ error: "iss is required" });
  });

  it("builds the platform auth redirect with nonce and state", () => {
    const state = newOidcState({ iss: "https://school.brightspace.com", clientId: "cid" });
    expect(state.state).toHaveLength(48);
    expect(oidcStateIsFresh(state)).toBe(true);
    expect(oidcStateIsFresh({ expiresAt: "2000-01-01T00:00:00.000Z" })).toBe(false);
    const url = buildPlatformAuthRedirect({
      authLoginUrl: "https://school.brightspace.com/d2l/lti/authenticate",
      clientId: "cid",
      redirectUri: "https://uncertain.systems/lti/launch",
      state: state.state,
      nonce: state.nonce,
      loginHint: "hint",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("response_mode")).toBe("form_post");
    expect(parsed.searchParams.get("nonce")).toBe(state.nonce);
    expect(parsed.searchParams.get("client_id")).toBe("cid");
  });
});
