/**
 * Vision and Science share one hub at /science, with a directory and
 * deep links from harness, verification, and pricing.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TOP_LINKS } from "@/lib/marketing/nav";
import { HARNESS_PRODUCT_COPY } from "@/lib/marketing/harness-product";
import { MAPPING_PRODUCT_COPY } from "@/lib/marketing/mapping-product";
import { VERIFICATION_APPROACH_COPY } from "@/lib/marketing/verification-product";
import { HARNESS_PRICING_COPY } from "@/lib/pricing/harness-copy";
import { VERIFICATION_PRICING_COPY } from "@/lib/pricing/verification-copy";
import {
  HARNESS_THESIS_LINKS,
  MAPPING_THESIS_LINKS,
  SCIENCE_FEP_PATH,
  SCIENCE_HUB_COPY,
  SCIENCE_HUB_DIRECTORY,
  SCIENCE_HUB_PATH,
  SCIENCE_WHY_PATH,
  VERIFICATION_THESIS_LINKS,
} from "@/lib/science/hub";
import { SCIENCE_EPISTEMIC_FORAGING_PATH } from "@/lib/science/epistemic-foraging-copy";
import { SCIENCE_LEARNING_MODEL_PATH } from "@/lib/science/learning-model-copy";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("combined vision + science hub", () => {
  it("nav and footer expose one Vision door into /science", () => {
    expect(TOP_LINKS).toEqual([{ href: "/science", label: "Vision" }]);
    expect(SCIENCE_HUB_PATH).toBe("/science");
    const footer = read("components/Footer.tsx");
    expect(footer).toContain('href: "/science"');
    expect(footer).toContain("footer.vision");
    expect(footer).not.toContain("footer.science");
    expect(read("components/Navbar.tsx")).toContain('{ href: "/science", label: "Vision" }');
    expect(read("next.config.ts")).toContain('source: "/vision"');
    expect(read("next.config.ts")).toContain('destination: "/science"');
    expect(read("app/vision/page.tsx")).toContain('redirect("/science")');
    expect(read("app/sitemap.ts")).toContain("/science");
    expect(read("app/sitemap.ts")).not.toMatch(/url: `\$\{baseUrl\}\/vision`/);
  });

  it("hub opens with a directory of why, policy, generative model, and tomography", () => {
    const page = read("app/science/page.tsx");
    expect(page).toContain("data-science-hub");
    expect(page).toContain("console-copy");
    expect(page).toContain("lg:grid-cols-12");
    expect(page).toContain("md:grid-cols-3");
    expect(page).not.toContain("bg-zinc-900");
    expect(page).toContain("MarketingDirectoryHero");
    expect(page).toContain("SCIENCE_HUB_DIRECTORY");
    expect(page).toContain('marker="science-hub"');
    expect(read("components/marketing/MarketingDirectoryHero.tsx")).toContain("ThesisDirectory");
    expect(read("components/marketing/MarketingDirectoryHero.tsx")).toContain('tone="index"');
    expect(page).toContain("ScrollToHash");
    expect(page).toContain("[&_section[id]]:scroll-mt-24");
    expect(page).toContain('id="why"');
    expect(page).toContain("SCIENCE_HUB_COPY.whyTitle");
    expect(page).toContain("SCIENCE_HUB_COPY.whyImageSrc");
    expect(page).toContain("MARKETING_MEDIA_FILL_CLASS");
    expect(page).toContain("data-science-why-visual");
    expect(page).toContain("SCIENCE_HUB_COPY.whyP1");
    expect(page).toContain("SCIENCE_HUB_COPY.whyP2");
    expect(page).toContain("SCIENCE_HUB_COPY.whyP3");
    expect(page).not.toContain("SCIENCE_HUB_WHY");
    expect(page).not.toContain("Low ROI Learning");
    expect(SCIENCE_HUB_COPY.whyImageSrc).toBe("/why.jpg");
    expect(existsSync(join(ROOT, "public/why.jpg"))).toBe(true);
    expect(page).not.toContain('className="sr-only"');
    expect(read("components/science/ThesisDirectory.tsx")).toContain('link.href.startsWith("#")');
    expect(read("components/science/ScrollToHash.tsx")).toContain("scrollIntoView");
    expect(SCIENCE_HUB_DIRECTORY.map((row) => row.href)).toEqual([
      "#why",
      "#science-free-energy",
      "#science-epistemic-foraging",
      SCIENCE_LEARNING_MODEL_PATH,
      "#knowledge-tomography-induction",
      "#cognitive-enhancement",
      "#human-ai-symbiosis",
      "#software-and-research",
      "#science-references",
    ]);
    expect(
      SCIENCE_HUB_DIRECTORY.find((row) => row.href === SCIENCE_LEARNING_MODEL_PATH)?.label,
    ).toBe("Unsys model");
  });

  it("harness, verification, and pricing deep-link into the hub", () => {
    expect(HARNESS_PRODUCT_COPY.thesisLinks).toEqual(HARNESS_THESIS_LINKS);
    expect(VERIFICATION_APPROACH_COPY.thesisLinks).toEqual(VERIFICATION_THESIS_LINKS);
    expect(MAPPING_PRODUCT_COPY.thesisLinks).toEqual(MAPPING_THESIS_LINKS);
    expect(MAPPING_THESIS_LINKS.map((row) => row.href)).toEqual([
      SCIENCE_FEP_PATH,
      SCIENCE_EPISTEMIC_FORAGING_PATH,
      SCIENCE_LEARNING_MODEL_PATH,
    ]);
    expect(HARNESS_THESIS_LINKS.map((row) => row.href)).toEqual([
      SCIENCE_EPISTEMIC_FORAGING_PATH,
      SCIENCE_LEARNING_MODEL_PATH,
      SCIENCE_WHY_PATH,
    ]);
    expect(
      HARNESS_THESIS_LINKS.find((row) => row.href === SCIENCE_LEARNING_MODEL_PATH)?.label,
    ).toBe("Unsys model");
    expect(read("app/solve-protocols/page.tsx")).toContain("MarketingDirectoryHero");
    expect(read("app/solve-protocols/page.tsx")).toContain('marker="harness"');
    expect(read("app/verify-protocols/page.tsx")).toContain("MarketingDirectoryHero");
    expect(read("app/verify-protocols/page.tsx")).toContain('marker="verification"');
    expect(read("app/mapping-protocols/page.tsx")).toContain("MarketingDirectoryHero");
    expect(read("app/mapping-protocols/page.tsx")).toContain('marker="mapping"');
    expect(read("app/pricing/page.tsx")).not.toContain("ThesisDirectory");
    expect(HARNESS_PRICING_COPY.thesisLinks.length).toBeGreaterThan(0);
    expect(HARNESS_PRICING_COPY.thesisLinks.map((row) => row.label)).toContain("Unsys model");
    expect(VERIFICATION_PRICING_COPY.thesisLinks.length).toBeGreaterThan(0);
  });
});
