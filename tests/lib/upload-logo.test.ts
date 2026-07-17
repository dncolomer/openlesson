import { describe, expect, it } from "vitest";
import { parseLogoPayload } from "@/lib/organization/upload-logo";

describe("parseLogoPayload", () => {
  it("accepts a valid logo payload", () => {
    expect(
      parseLogoPayload({
        logo: { data: "abc123", mimeType: "image/png", fileName: "logo.png" },
      })
    ).toEqual({
      data: "abc123",
      mimeType: "image/png",
      fileName: "logo.png",
    });
  });

  it("rejects missing logo", () => {
    expect(parseLogoPayload({})).toBeNull();
    expect(parseLogoPayload(null)).toBeNull();
    expect(parseLogoPayload({ logo: { data: 1, mimeType: "image/png" } })).toBeNull();
  });
});
