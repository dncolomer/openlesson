import { describe, expect, it } from "vitest";
import { ltiResourceTarget, ownerInOrganization } from "@/lib/lti/resource-link";

describe("ltiResourceTarget", () => {
  it("reads flow_token from custom claims", () => {
    expect(ltiResourceTarget({ custom: { flow_token: "abc" } })).toEqual({
      kind: "flow",
      flowToken: "abc",
    });
  });

  it("reads region_id and create_region action", () => {
    expect(ltiResourceTarget({ custom: { region_id: "reg-1" } })).toEqual({
      kind: "region",
      regionId: "reg-1",
    });
    expect(ltiResourceTarget({ custom: { action: "create_region" } })).toEqual({
      kind: "create_region",
    });
  });

  it("parses public flow paths from target_link_uri", () => {
    expect(
      ltiResourceTarget({ targetLinkUri: "https://uncertain.systems/v/tok%2Fen" }),
    ).toEqual({
      kind: "flow",
      flowToken: "tok/en",
      flowKind: "verification",
    });
  });

  it("refuses owners outside the organization", () => {
    expect(ownerInOrganization("u1", ["u1", "u2"])).toBe(true);
    expect(ownerInOrganization("u9", ["u1"])).toBe(false);
    expect(ownerInOrganization("", ["u1"])).toBe(false);
  });
});
