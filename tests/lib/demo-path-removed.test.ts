/**
 * Structural proof that the product /demo hub and /api/demo/* surface are gone.
 * Client-facing demos are the synthetic staging workspace only (lib/demo/saas-tech-*).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("product /demo hub removed", () => {
  it("does not ship app/demo page or OG entry", () => {
    expect(existsSync(join(ROOT, "app/demo/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/demo/opengraph-image.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/ProofOfWorkApiDemo.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/proof-of-work-demo"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/product-demos"))).toBe(false);
  });

  it("does not ship product-demo API routes under /api/demo", () => {
    expect(existsSync(join(ROOT, "app/api/demo"))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/demo/workspace/route.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/demo/status/route.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/demo/performance/route.ts"))).toBe(false);
  });

  it("middleware no longer special-cases /demo or /api/demo", () => {
    const mw = read("middleware.ts");
    expect(mw).not.toMatch(/pathname === ["']\/demo["']/);
    expect(mw).not.toContain("/api/demo");
    expect(mw).not.toContain("isDemoPage");
    expect(mw).not.toContain("isDemoApi");
  });

  it("OG registry does not require a /demo share surface", () => {
    const surfaces = read("lib/og/surfaces.ts");
    expect(surfaces).not.toMatch(/path:\s*["']\/demo["']/);
    expect(surfaces).not.toMatch(/id:\s*["']demo["']/);
    expect(surfaces).not.toMatch(/["']demo["']\s*,/);
  });

  it("workspace access admin gate uses non-demo /api/me/status", () => {
    const access = read("components/WorkspaceAccessSettings.tsx");
    expect(access).toContain("/api/me/status");
    expect(access).not.toContain("/api/demo/status");
    expect(existsSync(join(ROOT, "app/api/me/status/route.ts"))).toBe(true);
    const me = read("app/api/me/status/route.ts");
    expect(me).toContain("isAdmin");
    expect(me).toContain("is_admin");
  });

  it("keeps synthetic SaaS-role workspace helpers as client demo story", () => {
    expect(existsSync(join(ROOT, "lib/demo/saas-tech-team-demo-workspace.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "scripts/seed-saas-tech-team-demo-workspace.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "scripts/verify-saas-tech-team-demo-workspace.ts"))).toBe(true);
  });
});
