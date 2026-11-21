import { describe, expect, it } from "vitest";
import { jwtVerify } from "jose";
import {
  deepLinkContentItem,
  deepLinkReturnForm,
  signDeepLinkingResponse,
} from "@/lib/lti/deep-link";
import { generateLtiToolKey, importLtiPrivateKey } from "@/lib/lti/keys";
import {
  parseNrpsMembers,
  nrpsDisplayName,
  nrpsNamesForIdentities,
  seedLtiRosterNames,
  parseLtiRosterNames,
} from "@/lib/lti/nrps";

describe("lti deep linking", () => {
  it("returns flow, region, and create-region content items", () => {
    expect(
      deepLinkContentItem("https://uncertain.systems", {
        type: "flow",
        id: "f1",
        name: "Ohm",
        kind: "solve",
        publicToken: "tok",
      }),
    ).toMatchObject({
      type: "ltiResourceLink",
      custom: { flow_token: "tok" },
    });
    expect(
      deepLinkContentItem("https://uncertain.systems", {
        type: "region",
        id: "kr-1",
        name: "Class region",
        kind: "solve",
      }),
    ).toMatchObject({ custom: { region_id: "kr-1" } });
    expect(
      deepLinkContentItem("https://uncertain.systems", { type: "create_region" }),
    ).toMatchObject({ custom: { action: "create_region" } });
  });

  it("signs a Deep Linking response JWT", async () => {
    const key = await generateLtiToolKey("tool-1");
    const jwt = await signDeepLinkingResponse({
      issuer: "https://uncertain.systems",
      clientId: "cid",
      deploymentId: "dep-1",
      settings: { deep_link_return_url: "https://school.brightspace.com/d2l/lti/dl" },
      contentItems: [
        deepLinkContentItem("https://uncertain.systems", { type: "create_region" }),
      ],
      privateKey: await importLtiPrivateKey(key.privateJwk),
      kid: key.kid,
    });
    const verified = await jwtVerify(jwt, await importLtiPrivateKey(key.publicJwk), {
      issuer: "https://uncertain.systems",
      audience: "cid",
    });
    expect(verified.payload["https://purl.imsglobal.org/spec/lti/claim/message_type"]).toBe(
      "LtiDeepLinkingResponse",
    );
    expect(deepLinkReturnForm("https://school.brightspace.com/d2l/lti/dl", jwt)).toContain(
      "name=\"JWT\"",
    );
  });
});

describe("nrps members", () => {
  it("maps membership names onto LTI user ids", () => {
    const members = parseNrpsMembers({
      members: [{ user_id: "user-9", name: "Ada", email: "ada@school.edu", roles: [] }],
    });
    expect(nrpsDisplayName(members, "user-9")).toBe("Ada");
    const identity = "lti:https://school.brightspace.com:user-9";
    expect(
      nrpsNamesForIdentities({
        members,
        identities: [identity, "guest-1"],
        issuer: "https://school.brightspace.com",
      }),
    ).toEqual({ [identity]: "Ada" });
    expect(seedLtiRosterNames({ identity, displayName: "Ada Lovelace" })).toEqual({
      [identity]: "Ada Lovelace",
    });
    expect(parseLtiRosterNames({ [identity]: "Ada", "": "skip" })).toEqual({
      [identity]: "Ada",
    });
  });
});
