/**
 * Sales product cards ship optional LP product visuals (ranking + knowledge).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SALES_PRODUCT_CARDS } from "@/lib/sales/product-cards";

const ROOT = join(__dirname, "../..");

describe("sales product cards embed LP product visuals", () => {
  it("maps screening → ranking_app and take-home → knowledgeg2", () => {
    const screening = SALES_PRODUCT_CARDS.find(
      (c) => c.slug === "early-self-service-screening",
    );
    const takeHome = SALES_PRODUCT_CARDS.find(
      (c) => c.slug === "autonomous-take-home-assignment",
    );
    expect(screening?.image).toBe("/ranking_app.png");
    expect(takeHome?.image).toBe("/knowledgeg2.png");
    expect(existsSync(join(ROOT, "public/ranking_app.png"))).toBe(true);
    expect(existsSync(join(ROOT, "public/knowledgeg2.png"))).toBe(true);
  });

  it("detail page and sales index render product images", () => {
    const page = readFileSync(join(ROOT, "components/SalesProductCardPage.tsx"), "utf8");
    const index = readFileSync(join(ROOT, "app/sales/page.tsx"), "utf8");
    expect(page).toContain("data-sales-product-visual");
    expect(page).toContain("card.image");
    expect(page).toContain("next/image");
    expect(index).toContain("data-sales-index-thumb");
    expect(index).toContain("card.image");
  });
});
