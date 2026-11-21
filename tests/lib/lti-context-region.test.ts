import { describe, expect, it } from "vitest";
import { contextRegionKey, parseContextRegionBind } from "@/lib/lti/context-region";
import { parsePlatformRegistration } from "@/lib/lti/platform";

describe("lti context region", () => {
  it("binds a course context to a knowledge region", () => {
    const bind = parseContextRegionBind({
      platform_id: "p1",
      deployment_id: "d1",
      context_id: "course-9",
      knowledge_region_id: "kr-1",
    });
    expect(bind).toMatchObject({
      platformId: "p1",
      knowledgeRegionId: "kr-1",
    });
    if ("error" in bind) throw new Error(bind.error);
    expect(contextRegionKey(bind)).toBe("p1:d1:course-9");
  });
});

describe("lti platform registration", () => {
  it("requires issuer, client_id, login URL, and keyset", () => {
    const parsed = parsePlatformRegistration(
      {
        issuer: "https://school.brightspace.com",
        client_id: "cid",
        auth_login_url: "https://school.brightspace.com/lti/authenticate",
        auth_token_url: "https://auth.brightspace.com/core/connect/token",
        keyset_url: "https://school.brightspace.com/d2l/.well-known/jwks",
        deployment_ids: "dep-1, dep-2",
      },
      "org-1",
    );
    expect(parsed).toMatchObject({
      organizationId: "org-1",
      clientId: "cid",
      deploymentIds: ["dep-1", "dep-2"],
    });
    expect(parsePlatformRegistration({}, "org-1")).toEqual({ error: "issuer is required" });
  });
});
