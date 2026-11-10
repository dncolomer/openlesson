import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RETIRED_PRODUCT_BODY,
  RETIRED_PRODUCT_EMAIL,
  RETIRED_PRODUCT_HEADING,
  RETIRED_PRODUCT_PATHS,
} from "@/lib/retired-product";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("retired product page", () => {
  it("uses Greco aesthetic background and a centered contact message", () => {
    const page = read("components/retired-product-page.tsx");
    const copy = read("lib/retired-product.ts");
    expect(page).toContain("PublicPageField");
    expect(page).toContain("PUBLIC_FIELD_DEFAULT_STILL");
    expect(page).toContain("data-retired-product-page");
    expect(page).toContain("items-center justify-center");
    expect(page).toContain("text-center");
    expect(page).toContain("RETIRED_PRODUCT_HEADING");
    expect(page).toContain("RETIRED_PRODUCT_EMAIL");
    expect(copy).toContain(RETIRED_PRODUCT_EMAIL);
    expect(copy).toContain("no longer here");
    expect(RETIRED_PRODUCT_HEADING.toLowerCase()).toContain("not here anymore");
    expect(RETIRED_PRODUCT_BODY.toLowerCase()).toContain("learning map");
    expect(RETIRED_PRODUCT_BODY.toLowerCase()).toContain("workspace");
    expect(RETIRED_PRODUCT_EMAIL).toBe("daniel@uncertain.systems");
    expect(read("app/not-found.tsx")).toContain("RetiredProductPage");
  });

  it("resolves known retired paths to the retired screen, not the old implementations", () => {
    expect([...RETIRED_PRODUCT_PATHS]).toEqual([
      "/workspace",
      "/workspaces",
      "/all-you-can-learn",
      "/support",
      "/docs/learning-map-api",
      "/p",
      "/brain-priming",
    ]);
    expect(read("app/workspace/[[...slug]]/page.tsx")).toContain("RetiredProductPage");
    expect(read("app/workspaces/page.tsx")).toContain("RetiredProductPage");
    expect(read("app/all-you-can-learn/[[...slug]]/page.tsx")).toContain("RetiredProductPage");
    expect(read("app/support/page.tsx")).toContain("RetiredProductPage");
    expect(read("app/docs/learning-map-api/[[...slug]]/page.tsx")).toContain("RetiredProductPage");
    expect(read("app/p/[id]/[slug]/page.tsx")).toContain("RetiredProductPage");
    expect(read("app/p/[id]/[slug]/page.tsx")).not.toContain("WorkspaceView");
    expect(read("app/brain-priming/page.tsx")).toContain("RetiredProductPage");
    expect(read("app/brain-priming/join/page.tsx")).toContain("RetiredProductPage");
    expect(existsSync(join(ROOT, "app/workspace/[id]/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/workspace/new/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/all-you-can-learn/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/all-you-can-learn/[workspaceId]/page.tsx"))).toBe(false);
    const support = read("app/support/page.tsx");
    expect(support).not.toContain("Support this Project");
    expect(support).not.toContain("$UNSYS");
    const docs = read("app/docs/learning-map-api/[[...slug]]/page.tsx");
    expect(docs).not.toContain("Learning Map API");
    expect(docs).toContain("RetiredProductPage");
  });
});
