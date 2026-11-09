/**
 * Shared positioning contract for the five public product routes.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APPROVED_BRAND_ANCHOR, homepageCopyText } from "@/lib/marketing/platform";
import { HARNESS_PRODUCT_COPY } from "@/lib/marketing/harness-product";
import {
  VERIFICATION_APPROACH_COPY,
  VERIFICATION_FLOW_COPY,
  VERIFICATION_PLATFORM_COPY,
  VERIFICATION_PRODUCT_COPY,
} from "@/lib/marketing/verification-product";
import { MAPPING_PLATFORM_COPY, MAPPING_PRODUCT_COPY } from "@/lib/marketing/mapping-product";
import { USE_CASES, USE_CASES_COPY, USE_CASES_OTHER, useCasesCopyText } from "@/lib/marketing/use-cases";
import { landingHeroCopyText } from "@/lib/marketing/landing-variants";
import {
  DISCOVERY_CTA_LABEL,
  ENTERPRISE_SETUP_MAILTO,
  KNOWLEDGE_MAPPING_PATH,
  KNOWLEDGE_VERIFICATION_PATH,
  LEARNING_HARNESS_PATH,
  USE_CASES_PATH,
} from "@/lib/marketing/paths";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const SCOPED_SOURCES = [
  "lib/marketing/platform.ts",
  "lib/marketing/landing-variants.ts",
  "lib/marketing/harness-product.ts",
  "lib/marketing/verification-product.ts",
  "lib/marketing/mapping-product.ts",
  "lib/marketing/use-cases.ts",
  "app/page.tsx",
  "app/solve-protocols/page.tsx",
  "app/verify-protocols/page.tsx",
  "app/mapping-protocols/page.tsx",
  "app/use-cases/page.tsx",
  "components/marketing/landing-heroes.tsx",
] as const;

function scopedCorpus(): string {
  return [
    homepageCopyText(),
    landingHeroCopyText(),
    useCasesCopyText(),
    JSON.stringify(HARNESS_PRODUCT_COPY),
    JSON.stringify(VERIFICATION_PRODUCT_COPY),
    JSON.stringify(VERIFICATION_PLATFORM_COPY),
    JSON.stringify(VERIFICATION_FLOW_COPY),
    JSON.stringify(VERIFICATION_APPROACH_COPY),
    JSON.stringify(MAPPING_PRODUCT_COPY),
    JSON.stringify(MAPPING_PLATFORM_COPY),
    ...SCOPED_SOURCES.map((rel) => read(rel)),
  ].join("\n");
}

describe("five-page positioning contract", () => {
  it("keeps the approved brand anchor once on the homepage", () => {
    expect(APPROVED_BRAND_ANCHOR).toBe(
      "Uncertain Systems is the autopilot for knowledge building, bringing human and artificial intelligence together so people can understand more with less effort.",
    );
    expect(homepageCopyText()).toContain(APPROVED_BRAND_ANCHOR);
    expect(landingHeroCopyText()).toContain(APPROVED_BRAND_ANCHOR);
    expect(useCasesCopyText()).not.toContain(APPROVED_BRAND_ANCHOR);
    expect(HARNESS_PRODUCT_COPY.lead).not.toContain(APPROVED_BRAND_ANCHOR);
    expect(VERIFICATION_PRODUCT_COPY.lead).not.toContain(APPROVED_BRAND_ANCHOR);
    expect(MAPPING_PRODUCT_COPY.lead).not.toContain(APPROVED_BRAND_ANCHOR);
  });

  it("removes rejected steering slogans and fake-proof claims from scoped copy", () => {
    const corpus = scopedCorpus();
    expect(corpus).not.toMatch(/thinking stays yours/i);
    expect(corpus).not.toMatch(/thinking stays human/i);
    expect(corpus).not.toMatch(/driver'?s seat/i);
    expect(corpus).not.toMatch(/cannot be cheated or faked/i);
    expect(corpus).not.toMatch(/uncheatable|unfakeable/i);
    expect(corpus).not.toMatch(/\u2014/);
    expect(corpus).not.toMatch(/\blanded\b/);
  });

  it("preserves product routes, discovery mailto, and workspace as a secondary path", () => {
    expect(LEARNING_HARNESS_PATH).toBe("/solve-protocols");
    expect(KNOWLEDGE_VERIFICATION_PATH).toBe("/verify-protocols");
    expect(KNOWLEDGE_MAPPING_PATH).toBe("/mapping-protocols");
    expect(USE_CASES_PATH).toBe("/use-cases");
    expect(DISCOVERY_CTA_LABEL).toBe("Discuss your use case");
    expect(ENTERPRISE_SETUP_MAILTO).toBe("mailto:daniel@uncertain.systems");
    expect(HARNESS_PRODUCT_COPY.workspaceHref).toBe("/workspace/new");
    expect(read("app/solve-protocols/page.tsx")).toContain("HARNESS_PRODUCT_COPY.workspaceHref");
    expect(read("next.config.ts")).not.toMatch(
      /source:\s*["']\/knowledge-mapping["']\s*,\s*destination:\s*["']\/mapping["']/,
    );
  });

  it("ships three complementary primary use cases with preserved fragment ids", () => {
    expect(USE_CASES_COPY.title).toBe("Put knowledge building to work");
    expect(USE_CASES.map((item) => item.id)).toEqual([
      "research-ai",
      "company-expertise",
      "technical-hiring",
    ]);
    expect(USE_CASES_OTHER).toHaveLength(3);
    expect(USE_CASES_OTHER.map((item) => item.title)).toEqual([
      "Agent-harness evaluation",
      "Institute and course-authoring programs",
      "Knowledge and neuroscience studies",
    ]);
  });
});
