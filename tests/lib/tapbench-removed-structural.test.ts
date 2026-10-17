/**
 * Structural proof that TAPBench pages, APIs, and product chrome are gone.
 * Three base flows remain: Calibrate, Learn, Verify.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HEADLESS_FLOW_KINDS, parseHeadlessFlowKind } from "@/lib/pow-api/headless-session";
import { COMMUNITY_LINKS } from "@/lib/marketing/nav";
import { PLATFORM_PRODUCT_LIST, PLATFORM_PRODUCTS } from "@/lib/marketing/platform";
import { VERIFICATION_PRODUCT_COPY, VERIFICATION_SCALE_COPY } from "@/lib/marketing/verification-product";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("TAPBench product surfaces removed", () => {
  it("does not ship /tapbench App Router pages", () => {
    expect(existsSync(join(ROOT, "app/tapbench"))).toBe(false);
    expect(existsSync(join(ROOT, "app/tapbench/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/tapbench/[token]/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/tapbench/workspace/[id]/page.tsx"))).toBe(false);
  });

  it("does not ship TAPBench landing/shell/detail components", () => {
    expect(existsSync(join(ROOT, "components/TapbenchLanding.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/TapbenchShell.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/TapbenchResultsIntro.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/TapbenchResultsTable.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/TapbenchWorkspaceDetail.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/TapbenchExperimentTutorial.tsx"))).toBe(false);
  });

  it("does not ship TAPBench HTTP families", () => {
    expect(existsSync(join(ROOT, "app/api/v3/tapbench"))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/tapbench"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/tapbench"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/pow-api/create-tapbench-link.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/pow-api/tapbench-store.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/pow-api/stash-tapbench-auth.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/pow-api/tapbench-skills-md.ts"))).toBe(false);
    const powRoute = read("app/api/v3/pow/workspaces/[id]/proof-of-work/route.ts");
    expect(powRoute).not.toContain("tapbench_key");
    expect(powRoute).not.toContain("@/lib/tapbench");
  });

  it("middleware, next config, sitemap, and nav no longer special-case /tapbench", () => {
    const mw = read("middleware.ts");
    expect(mw).not.toContain("/tapbench");
    const next = read("next.config.ts");
    expect(next).not.toContain("/tapbench");
    const sitemap = read("app/sitemap.ts");
    expect(sitemap).not.toContain("/tapbench");
    const navbar = read("components/Navbar.tsx");
    expect(navbar).not.toContain("/tapbench");
    expect(navbar).not.toContain("TAPBench");
    expect(COMMUNITY_LINKS.some((link) => (link.href as string) === "/tapbench")).toBe(false);
    expect(COMMUNITY_LINKS.some((link) => /tapbench/i.test(link.label))).toBe(false);
  });

  it("marketing catalog and knowledge-verification CTA no longer label TAPBench", () => {
    expect("tapbench" in PLATFORM_PRODUCTS).toBe(false);
    expect(PLATFORM_PRODUCT_LIST.some((p) => (p.href as string) === "/tapbench")).toBe(false);
    expect(PLATFORM_PRODUCT_LIST.some((p) => /tapbench/i.test(p.name))).toBe(false);
    expect("tapbenchHref" in VERIFICATION_PRODUCT_COPY).toBe(false);
    expect("tapbenchCta" in VERIFICATION_PRODUCT_COPY).toBe(false);
    expect("tapbenchHref" in VERIFICATION_SCALE_COPY).toBe(false);
    const kv = read("app/knowledge-verification/page.tsx");
    expect(kv).not.toContain("data-landing-tapbench");
    expect(kv).not.toContain("tapbenchHref");
    expect(kv).not.toContain("TAPBench");
  });

  it("headless parser accepts only calibrate, learn, verify", () => {
    expect([...HEADLESS_FLOW_KINDS]).toEqual(["calibrate", "learn", "verify"]);
    expect(parseHeadlessFlowKind("calibrate")).toBe("calibrate");
    expect(parseHeadlessFlowKind("learn")).toBe("learn");
    expect(parseHeadlessFlowKind("verify")).toBe("verify");
    expect(parseHeadlessFlowKind("tapbench")).toBeNull();
    expect(parseHeadlessFlowKind("scout")).toBe("calibrate");
  });
});
