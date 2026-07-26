/**
 * TAP + ILE desktop gate: smartphone detection + MobileBlockScreen wiring.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isSmartphoneClient,
  isSmartphoneUserAgent,
  isSmartphoneViewport,
} from "@/lib/is-smartphone";

const ROOT = join(__dirname, "../..");

describe("isSmartphone pure helpers", () => {
  it("detects phone UAs and not desktop Chrome", () => {
    expect(isSmartphoneUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(
      true,
    );
    expect(
      isSmartphoneUserAgent(
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36",
      ),
    ).toBe(true);
    expect(
      isSmartphoneUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0",
      ),
    ).toBe(false);
    expect(isSmartphoneUserAgent("")).toBe(false);
    expect(isSmartphoneUserAgent(null)).toBe(false);
  });

  it("treats narrow viewports as phone-class", () => {
    expect(isSmartphoneViewport(375)).toBe(true);
    expect(isSmartphoneViewport(767)).toBe(true);
    expect(isSmartphoneViewport(768)).toBe(false);
    expect(isSmartphoneViewport(1280)).toBe(false);
  });

  it("combines UA and width for isSmartphoneClient", () => {
    expect(
      isSmartphoneClient({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        width: 1024,
      }),
    ).toBe(true);
    expect(
      isSmartphoneClient({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120",
        width: 390,
      }),
    ).toBe(true);
    expect(
      isSmartphoneClient({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120",
        width: 1280,
      }),
    ).toBe(false);
  });
});

describe("TAP and ILE mount desktop-only smartphone gate", () => {
  it("TapScoreClient and SessionView (ILE) show MobileBlockScreen on smartphone", () => {
    expect(existsSync(join(ROOT, "lib/is-smartphone.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "components/MobileBlockScreen.tsx"))).toBe(true);

    const tap = readFileSync(join(ROOT, "components/TapScoreClient.tsx"), "utf8");
    const session = readFileSync(join(ROOT, "components/SessionView.tsx"), "utf8");
    const ile = readFileSync(join(ROOT, "components/IleGuestSessionClient.tsx"), "utf8");
    const block = readFileSync(join(ROOT, "components/MobileBlockScreen.tsx"), "utf8");

    expect(tap).toContain("isSmartphoneClient");
    expect(tap).toContain("MobileBlockScreen");
    expect(tap).toContain('product="tap"');
    expect(tap).toMatch(/if\s*\(\s*isMobile\s*\)/);

    expect(session).toContain("isSmartphoneClient");
    expect(session).toContain("MobileBlockScreen");
    expect(session).toContain('product={ileToken ? "ile" : "session"}');

    // ILE guest path is SessionView
    expect(ile).toContain("SessionView");
    expect(ile).toContain("ileToken");

    expect(block).toContain("data-mobile-block-screen");
    expect(block).toContain("Please switch to a desktop browser");
    expect(block).toContain("designed for desktop");
  });
});
