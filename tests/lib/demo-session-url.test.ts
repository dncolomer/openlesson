import { describe, expect, it } from "vitest";
import {
  buildDemoTapSessionUrl,
  normalizeDemoSessionUrl,
} from "@/lib/evidence-api-demo/demo-session-url";

describe("demo session urls", () => {
  it("builds tap session urls from the request origin", () => {
    expect(buildDemoTapSessionUrl("http://localhost:3000", "abc123")).toBe(
      "http://localhost:3000/tap/session/abc123"
    );
  });

  it("rewrites stored urls to the current browser origin", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { origin: "http://localhost:3000" } },
    });

    expect(normalizeDemoSessionUrl("https://openlesson.academy/tap/session/token-1")).toBe(
      "http://localhost:3000/tap/session/token-1"
    );
  });
});