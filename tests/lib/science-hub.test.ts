/**
 * Science hub at /science: why, Free Energy Principle, Unsys model.
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
  SCIENCE_EMBEDDING_PATH,
  SCIENCE_UNSYS_PATH,
  SCIENCE_WHY_PATH,
  VERIFICATION_THESIS_LINKS,
} from "@/lib/science/hub";
import { SCIENCE_LEARNING_MODEL_PATH } from "@/lib/science/learning-model-copy";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("science hub", () => {
  it("nav and footer expose Science at /science", () => {
    expect(TOP_LINKS).toEqual([{ href: "/science", label: "Science" }]);
    expect(SCIENCE_HUB_PATH).toBe("/science");
    const footer = read("components/Footer.tsx");
    expect(footer).toContain('href: "/science"');
    expect(footer).toContain("footer.science");
    expect(footer).not.toContain("footer.vision");
    expect(read("components/Navbar.tsx")).toContain('{ href: "/science", label: "Science" }');
    expect(read("next.config.ts")).toContain('source: "/vision"');
    expect(read("next.config.ts")).toContain('destination: "/science"');
    expect(read("app/vision/page.tsx")).toContain('redirect("/science")');
    expect(read("app/sitemap.ts")).toContain("/science");
    expect(read("app/sitemap.ts")).not.toMatch(/url: `\$\{baseUrl\}\/vision`/);
  });

  it("hub is why in the header, then FEP, Unsys, and embedding space", () => {
    const page = read("app/science/page.tsx");
    expect(page).toContain("data-science-hub");
    expect(page).toContain("console-copy");
    expect(page).toContain("lg:grid-cols-12");
    expect(page).not.toContain("bg-zinc-900");
    expect(page).toContain("MarketingDirectoryHero");
    expect(page).toContain("SCIENCE_HUB_DIRECTORY");
    expect(page).toContain('marker="science-hub"');
    expect(page).toContain("ScrollToHash");
    expect(page).toContain("[&_section[id]]:scroll-mt-24");
    expect(page).toContain('id="why"');
    expect(page).toContain("data-science-why");
    expect(page).toContain("SCIENCE_HUB_COPY.lead");
    expect(page).not.toContain("SCIENCE_HUB_COPY.whyImageSrc");
    expect(page).not.toContain("data-science-why-visual");
    expect(page).toContain("MARKETING_MEDIA_FILL_CLASS");
    expect(page).toContain("SCIENCE_HUB_COPY.fepImageSrc");
    expect(page).toContain("SCIENCE_HUB_COPY.unsysImageSrc");
    expect(page).toContain("SCIENCE_HUB_COPY.embeddingImageSrc");
    expect(page).toContain("data-science-embedding");
    expect(page).not.toContain("SCIENCE_HUB_WHY");
    expect(page).not.toContain("Low ROI Learning");
    expect(page).not.toContain("data-vision-tomography-induction");
    expect(page).not.toContain("data-science-enhancement");
    expect(page).not.toContain("data-science-symbiosis");
    expect(SCIENCE_HUB_COPY.lead).toEqual([
      SCIENCE_HUB_COPY.whyP1,
      SCIENCE_HUB_COPY.whyP2,
    ]);
    expect(SCIENCE_HUB_COPY.fepImageSrc).toBe("/science/proof-of-work.jpg");
    expect(SCIENCE_HUB_COPY.unsysImageSrc).toBe("/science/unsys-model.jpg");
    expect(SCIENCE_HUB_COPY.embeddingImageSrc).toBe("/science/embedding.jpg");
    expect(existsSync(join(ROOT, "public/science/why.jpg"))).toBe(false);
    expect(existsSync(join(ROOT, "public/science/embedding.jpg"))).toBe(true);
    expect(existsSync(join(ROOT, "public/science/unsys-model.jpg"))).toBe(true);
    expect(existsSync(join(ROOT, "public/science/proof-of-work.jpg"))).toBe(true);
    expect(SCIENCE_HUB_DIRECTORY.map((row) => row.href)).toEqual([
      "#science-free-energy",
      "#science-unsys-model",
      "#science-embedding",
    ]);
    expect(SCIENCE_UNSYS_PATH).toBe("/science#science-unsys-model");
    expect(SCIENCE_EMBEDDING_PATH).toBe("/science#science-embedding");
    expect(SCIENCE_WHY_PATH).toBe("/science#why");
    expect(
      SCIENCE_HUB_DIRECTORY.find((row) => row.href === "#science-unsys-model")?.label,
    ).toBe("Unsys model");
  });

  it("harness, verification, and pricing deep-link into the hub", () => {
    expect(HARNESS_PRODUCT_COPY.thesisLinks).toEqual(HARNESS_THESIS_LINKS);
    expect(VERIFICATION_APPROACH_COPY.thesisLinks).toEqual(VERIFICATION_THESIS_LINKS);
    expect(MAPPING_PRODUCT_COPY.thesisLinks).toEqual(MAPPING_THESIS_LINKS);
    expect(MAPPING_THESIS_LINKS.map((row) => row.href)).toEqual([
      SCIENCE_FEP_PATH,
      SCIENCE_LEARNING_MODEL_PATH,
      SCIENCE_EMBEDDING_PATH,
    ]);
    expect(HARNESS_THESIS_LINKS.map((row) => row.href)).toEqual([
      SCIENCE_FEP_PATH,
      SCIENCE_LEARNING_MODEL_PATH,
      SCIENCE_EMBEDDING_PATH,
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
