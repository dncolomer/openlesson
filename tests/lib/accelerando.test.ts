/**
 * Accelerando-8192 is a public-chrome overlay: real token encodings as
 * decorative glyphs. English copy stays the readable text.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AccelerandoField, AccelerandoMark, AccelerandoRun } from "@/components/AccelerandoGlyphs";
import { SectionHeading } from "@/components/marketing/MarketingChrome";
import { PublicConsoleWash } from "@/components/ui/console-frame";
import {
  ACCELERANDO_ENCODINGS,
  ACCELERANDO_FIELD_IDS,
  ACCELERANDO_PATHS,
  ACCELERANDO_SOURCE,
  accelerandoIds,
  accelerandoPath,
} from "@/lib/accelerando";
import { PLATFORM_DELIVERY, PLATFORM_HERO, PLATFORM_LAYERS, PLATFORM_SPINE } from "@/lib/marketing/platform";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Accelerando-8192 overlay", () => {
  it("precomputes reversible encodings for public labels and the field", () => {
    expect(accelerandoIds("Uncertain Systems")).toEqual([2265, 66, 805, 524, 1219, 82]);
    expect(accelerandoIds(PLATFORM_HERO.pill)).toEqual(ACCELERANDO_ENCODINGS[PLATFORM_HERO.pill]);
    expect(accelerandoIds(PLATFORM_SPINE.eyebrow)?.length).toBeGreaterThan(0);
    expect(accelerandoIds(PLATFORM_DELIVERY.eyebrow)?.length).toBeGreaterThan(0);
    expect(accelerandoIds(PLATFORM_LAYERS.eyebrow)?.length).toBeGreaterThan(0);
    expect(accelerandoIds("no such label")).toBeNull();

    for (const ids of Object.values(ACCELERANDO_ENCODINGS)) {
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(accelerandoPath(id)).toMatch(/^M\d/);
        expect(ACCELERANDO_PATHS[id]).toBeDefined();
      }
    }
    expect(ACCELERANDO_FIELD_IDS).toHaveLength(36);
    for (const id of ACCELERANDO_FIELD_IDS) {
      expect(ACCELERANDO_PATHS[id]).toMatch(/^M\d/);
    }
  });

  it("renders glyphs as hidden SVG strokes, not as replacement copy", () => {
    const run = renderToStaticMarkup(createElement(AccelerandoRun, { text: "TAP" }));
    expect(run).toContain("data-accelerando-run");
    expect(run).toContain("aria-hidden");
    expect(run).toContain("<svg");
    expect(run).toContain('viewBox="0 0 2 2"');
    expect(run).toContain(ACCELERANDO_PATHS[51]);
    expect(run).toContain(ACCELERANDO_PATHS[2685]);
    expect(run).not.toContain(">TAP<");

    const missing = renderToStaticMarkup(createElement(AccelerandoRun, { text: "unmapped" }));
    expect(missing).toBe("");

    expect(accelerandoIds("Simplify")).toEqual([50, 321, 528, 1985]);
    expect(accelerandoIds("Forage")).toEqual([2653, 477]);
    expect(accelerandoIds("Generative model")?.length).toBeGreaterThan(0);
    const mark = renderToStaticMarkup(createElement(AccelerandoMark, { text: "Check/ask", mark: "check" }));
    expect(mark).toContain('data-accelerando-mark="Check/ask"');
    expect(mark).toContain('data-ile-command-mark="check"');
    expect(mark).toContain("accelerando-mark");
    expect(mark).toContain('overflow="hidden"');
    expect(mark).toContain('width="100%"');
    expect(mark.split("<svg").length - 1).toBe(1);
    expect(mark).not.toContain(">Check/ask<");
    const one = renderToStaticMarkup(createElement(AccelerandoMark, { text: "Simplify" }));
    expect(one.split("<svg").length - 1).toBe(1);
    expect(one.split("<path").length - 1).toBe(1);
    expect(one).toContain(ACCELERANDO_PATHS[50]);
    expect(one).not.toContain(ACCELERANDO_PATHS[321]);
    const css = read("app/globals.css");
    expect(css).toContain(".accelerando-mark {");
    expect(css).toContain("overflow: clip");
    expect(css).toContain("clip-path: inset(0)");

    const field = renderToStaticMarkup(createElement(AccelerandoField));
    expect(field).toContain("data-accelerando-field");
    expect(field).toContain("aria-hidden");
    expect(field.split("<svg").length - 1).toBe(36);
  });

  it("sits on the public wash and section eyebrows without replacing English", () => {
    const wash = renderToStaticMarkup(createElement(PublicConsoleWash));
    expect(wash).toContain("data-accelerando-field");
    expect(wash).toContain('data-accelerando-run="Uncertain Systems"');
    expect(wash).toContain("data-console-frame-label");
    expect(wash).toContain(">01<");

    const heading = renderToStaticMarkup(
      createElement(SectionHeading, { eyebrow: PLATFORM_SPINE.eyebrow, title: PLATFORM_SPINE.title }),
    );
    expect(heading).toContain(PLATFORM_SPINE.eyebrow);
    expect(heading).toContain(PLATFORM_SPINE.title);
    expect(heading).toContain(`data-accelerando-run="${PLATFORM_SPINE.eyebrow}"`);

    const home = read("app/page.tsx");
    expect(home).toContain("{PLATFORM_HERO.pill}");
    expect(home).toContain("<AccelerandoRun text={PLATFORM_HERO.pill}");
    expect(home).toContain("<PublicConsoleWash />");

    const chrome = read("components/marketing/MarketingChrome.tsx");
    expect(chrome).toContain("<AccelerandoRun text={eyebrow}");
    expect(chrome).toContain("{title}");

    const footer = read("components/Footer.tsx");
    expect(footer).toContain("ACCELERANDO_SOURCE");
    expect(footer).toContain("Accelerando-8192");
    expect(ACCELERANDO_SOURCE).toBe("https://github.com/gillverd/accelerando-8192");

    expect(existsSync(join(ROOT, "public/data/alphabet.json"))).toBe(false);
    expect(existsSync(join(ROOT, "public/assets/accelerando-8192.ttf"))).toBe(false);
  });
});
