/**
 * Vision and Science share one hub at /science, with a directory and
 * deep links from harness, verification, and pricing.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOP_LINKS } from "@/lib/marketing/nav";
import { HARNESS_PRODUCT_COPY } from "@/lib/marketing/harness-product";
import { VERIFICATION_APPROACH_COPY } from "@/lib/marketing/verification-product";
import { HARNESS_PRICING_COPY } from "@/lib/pricing/harness-copy";
import { VERIFICATION_PRICING_COPY } from "@/lib/pricing/verification-copy";
import {
  HARNESS_THESIS_LINKS,
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

  it("hub opens with a directory of why, thesis, policy, generative model, and papers", () => {
    const page = read("app/science/page.tsx");
    expect(page).toContain("data-science-hub");
    expect(page).toContain("ThesisDirectory");
    expect(page).toContain("SCIENCE_HUB_DIRECTORY");
    expect(page).toContain("ScrollToHash");
    expect(page).toContain("[&_section[id]]:scroll-mt-24");
    expect(page).toContain('id="why"');
    expect(page).toContain("SCIENCE_HUB_COPY.whyTitle");
    expect(page).not.toContain('className="sr-only"');
    expect(read("components/science/ThesisDirectory.tsx")).toContain('link.href.startsWith("#")');
    expect(read("components/science/ScrollToHash.tsx")).toContain("scrollIntoView");
    expect(SCIENCE_HUB_DIRECTORY.map((row) => row.href)).toEqual([
      "#why",
      "#science-thesis-slide",
      "#science-free-energy",
      "#science-epistemic-foraging",
      SCIENCE_LEARNING_MODEL_PATH,
      "#knowledge-tomography-induction",
      "#research",
    ]);
    expect(
      SCIENCE_HUB_DIRECTORY.find((row) => row.href === SCIENCE_LEARNING_MODEL_PATH)?.label,
    ).toBe("Unsys model");
  });

  it("harness, verification, and pricing deep-link into the hub", () => {
    expect(HARNESS_PRODUCT_COPY.thesisLinks).toEqual(HARNESS_THESIS_LINKS);
    expect(VERIFICATION_APPROACH_COPY.thesisLinks).toEqual(VERIFICATION_THESIS_LINKS);
    expect(HARNESS_THESIS_LINKS.map((row) => row.href)).toEqual([
      SCIENCE_EPISTEMIC_FORAGING_PATH,
      SCIENCE_LEARNING_MODEL_PATH,
      SCIENCE_WHY_PATH,
    ]);
    expect(
      HARNESS_THESIS_LINKS.find((row) => row.href === SCIENCE_LEARNING_MODEL_PATH)?.label,
    ).toBe("Unsys model");
    expect(read("app/learning-harness/page.tsx")).toContain('marker="harness"');
    expect(read("app/knowledge-verification/page.tsx")).toContain('marker="verification"');
    expect(read("app/pricing/page.tsx")).toContain('marker="harness-pricing"');
    expect(read("app/pricing/verification/page.tsx")).toContain('marker="verification-pricing"');
    expect(HARNESS_PRICING_COPY.thesisLinks.length).toBeGreaterThan(0);
    expect(HARNESS_PRICING_COPY.thesisLinks.map((row) => row.label)).toContain("Unsys model");
    expect(VERIFICATION_PRICING_COPY.thesisLinks.length).toBeGreaterThan(0);
  });
});
