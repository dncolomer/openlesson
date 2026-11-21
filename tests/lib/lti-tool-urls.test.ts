import { describe, expect, it } from "vitest";
import { ltiToolUrls } from "@/lib/lti/tool-urls";

describe("ltiToolUrls", () => {
  it("builds Brightspace Register Tool fields from the origin", () => {
    const urls = ltiToolUrls("https://uncertain.systems/");
    expect(urls.domain).toBe("https://uncertain.systems");
    expect(urls.loginUrl).toBe("https://uncertain.systems/lti/login");
    expect(urls.launchUrl).toBe("https://uncertain.systems/lti/launch");
    expect(urls.jwksUrl).toBe("https://uncertain.systems/lti/jwks");
    expect(urls.deepLinkUrl).toBe("https://uncertain.systems/lti/deep-link");
    expect(urls.redirectUrls).toEqual([
      "https://uncertain.systems/lti/launch",
      "https://uncertain.systems/lti/deep-link",
    ]);
    expect(urls.targetLinkUri).toBe(urls.launchUrl);
  });
});
