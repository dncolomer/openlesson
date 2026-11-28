import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeLaunchCookie, decodeLaunchCookie } from "@/lib/lti/cookie";
import { resetLtiStore, upsertLtiPlatform, findLtiPlatform } from "@/lib/lti/store";

const ROOT = join(__dirname, "../..");

function read(path: string) {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("lti surfaces", () => {
  it("exposes Brightspace Register Tool routes", () => {
    expect(existsSync(join(ROOT, "app/lti/login/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/lti/launch/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/lti/jwks/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/lti/deep-link/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "supabase/archive/migrations-pre-20261128/20261121180000_lti_advantage.sql"))).toBe(
      true,
    );
    expect(read("app/lti/login/route.ts")).toContain("parseLoginInitiation");
    expect(read("app/lti/launch/route.ts")).toContain("verifyLtiIdToken");
    expect(read("components/dashboard/dashboard-integrations-tab.tsx")).toContain(
      "DashboardLmsCard",
    );
    expect(read("components/VerificationFlowRunner.tsx")).toContain("ltiIdentityForPublicToken");
    expect(read("messages/en.json")).toContain('"ltiTitle": "LTI 1.3 Advantage"');
    expect(read("messages/en.json")).toContain("any LTI-compliant LMS");
    expect(read("messages/en.json")).not.toMatch(/lti(Subtitle|PasteHint|Keyset)": "[^"]*Brightspace/);
    expect(read("components/lti/dashboard-lms-card.tsx")).not.toContain("brightspace");
    expect(read("app/api/lti/knowledge-regions/[id]/route.ts")).toContain(
      "ltiRosterNamesForIdentities",
    );
    expect(read("app/api/lti/knowledge-regions/[id]/route.ts")).toContain("rosterNames");
  });

  it("round-trips the launch cookie and memory platform store", async () => {
    const token = await encodeLaunchCookie({
      launchId: "l1",
      platformId: "p1",
      organizationId: "o1",
      issuer: "https://school.brightspace.com",
      clientId: "cid",
      sub: "user-9",
      identity: "lti:https://school.brightspace.com:user-9",
      displayName: "Ada",
      email: "ada@school.edu",
      instructor: false,
      contextId: "c1",
      deploymentId: "d1",
      resourceLinkId: "rl",
      flowToken: "tok",
      flowKind: "verification",
    });
    const session = await decodeLaunchCookie(token);
    expect(session?.identity).toBe("lti:https://school.brightspace.com:user-9");
    expect(session?.flowToken).toBe("tok");

    resetLtiStore("memory");
    await upsertLtiPlatform({
      organizationId: "o1",
      issuer: "https://school.brightspace.com",
      clientId: "cid",
      authLoginUrl: "https://school.brightspace.com/lti/authenticate",
      authTokenUrl: "https://auth.brightspace.com/core/connect/token",
      keysetUrl: "https://school.brightspace.com/d2l/.well-known/jwks",
      deploymentIds: ["d1"],
    });
    const found = await findLtiPlatform({
      issuer: "https://school.brightspace.com",
      clientId: "cid",
    });
    expect(found?.deploymentIds).toEqual(["d1"]);
  });
});
