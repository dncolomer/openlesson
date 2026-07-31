/**
 * Structural checks: Knowledge Regions UI, always-visible guest/TAPBench links, no alaTAP on touched paths.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  durableGuestLinkPublicToken,
  guestLinkUrlFromPublicToken,
  normalizeGuestLinkAccessMode,
  buildGuestLinkUrl,
} from "@/lib/guest-link-access";
import { buildTapbenchShareUrl } from "@/lib/pow-api/tapbench";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("UI: Knowledge Regions builder + Knowledge Links TAPBench", () => {
  it("regions keep builder filters; TAPBench mint lives under Knowledge Links", () => {
    const ui = read("components/CustomVerificationModelsPanel.tsx");
    expect(ui).not.toContain("Create from description or files");
    expect(ui).not.toContain("data-region-create-custom");
    expect(ui).not.toContain("data-create-synthetic-region");
    expect(ui).not.toContain("data-synthetic-region-prompt");
    expect(ui).not.toContain('action: "create_synthetic"');
    expect(ui).not.toContain("data-create-tapbench-link");
    expect(ui).not.toContain("data-tapbench-mint");
    expect(ui).toContain("data-region-builder");
    expect(ui).toContain("data-region-source-filter");
    expect(ui).toContain("data-region-link-filter");
    expect(ui).toContain("source_link_url");

    const links = read("components/WorkspaceTapbenchLinksPanel.tsx");
    expect(links).toContain("data-tapbench-mint");
    expect(links).toContain("data-create-tapbench-link");
    expect(links).toContain("data-tapbench-links-list");
    expect(links).toContain("data-tapbench-link-url");
    expect(links).toContain("/api/workspace/tapbench-links");
  });

  it("public /tapbench/[token] page exists and middleware allows it", () => {
    expect(existsSync(join(ROOT, "app/tapbench/[token]/page.tsx"))).toBe(true);
    const page = read("app/tapbench/[token]/page.tsx");
    expect(page).toContain("resolveTapbenchSessionToken");
    expect(page).toContain("data-tapbench-exercise");
    expect(page).toContain("session_token");
    // skills.md is referenced when agents visit the link
    expect(page).toContain("data-tapbench-skills-md");
    expect(page).toContain("skills.md");
    expect(page).toContain("/skills");
    const mw = read("middleware.ts");
    expect(mw).toMatch(/\/tapbench/);
    // Mint URL path is /tapbench/{token} not only /api/tapbench
    expect(read("lib/pow-api/tapbench.ts")).toContain('TAPBENCH_PUBLIC_PATH = "tapbench"');
  });
});

describe("Always-visible guest links (listable share URLs)", () => {
  it("durable public_token + URL helpers rebuild share URLs without client-only create memory", () => {
    const token = "secret_bearer_token_xyz";
    expect(durableGuestLinkPublicToken(token)).toBe(token);
    expect(guestLinkUrlFromPublicToken("https://app.test", "tap", token)).toBe(
      "https://app.test/tap/session/secret_bearer_token_xyz",
    );
    expect(guestLinkUrlFromPublicToken("https://app.test", "ile", token)).toBe(
      "https://app.test/ile/session/secret_bearer_token_xyz",
    );
    expect(guestLinkUrlFromPublicToken("https://app.test", "tap", null)).toBeNull();
    expect(buildTapbenchShareUrl("https://app.test", token)).toBe(
      "https://app.test/tapbench/secret_bearer_token_xyz",
    );
    expect(buildGuestLinkUrl("https://app.test", "tap", token)).toContain(token);
  });

  it("normalizeGuestLinkAccessMode accepts public (links not forced private-only)", () => {
    expect(normalizeGuestLinkAccessMode({ access_mode: "public" })).toBe("public");
    expect(normalizeGuestLinkAccessMode({ public: true })).toBe("public");
    expect(normalizeGuestLinkAccessMode({})).toBe("private");
  });

  it("create-tap-link and create-ile-link always store public_token for listability", () => {
    const tap = read("lib/pow-api/create-tap-link.ts");
    expect(tap).toContain("durableGuestLinkPublicToken");
    expect(tap).toMatch(/public_token:\s*publicToken|public_token:\s*durableGuestLinkPublicToken/);

    const ile = read("lib/pow-api/create-ile-link.ts");
    expect(ile).toContain("durableGuestLinkPublicToken");

    const tapList = read("app/api/workspace/tap-links/route.ts");
    expect(tapList).toContain("guestLinkUrlFromPublicToken");
    expect(tapList).toContain("url:");

    const ileList = read("app/api/workspace/ile-links/route.ts");
    expect(ileList).toContain("guestLinkUrlFromPublicToken");

    const guestUi = read("components/WorkspaceGuestLinksPanel.tsx");
    // Uses list URL from API, not only createdLinks client memory
    expect(guestUi).toMatch(/listUrl|\.url/);
    expect(guestUi).toContain("privateUrl");
  });

  it("tapbench list/mint APIs return stable url + public_token", () => {
    const route = read("app/api/workspace/tapbench-links/route.ts");
    expect(route).toContain("tapbench_links");
    expect(route).toContain("public_token");
    expect(route).toContain("url:");
    expect(route).toContain("session_token");
  });
});

describe("no alaTAP on touched Stash/TAPBench paths", () => {
  const touched = [
    "lib/pow-api/stash-api.ts",
    "lib/pow-api/tapbench.ts",
    "lib/pow-api/tapbench-store.ts",
    "lib/pow-api/stash-tapbench-auth.ts",
    "lib/pow-api/region-builder.ts",
    "app/api/v3/stash/workspaces/[id]/stash/route.ts",
    "app/api/v3/stash/workspaces/[id]/submit/route.ts",
    "app/api/v3/stash/workspaces/[id]/proof-of-work/route.ts",
    "app/api/workspace/tapbench-links/route.ts",
    "app/api/tapbench/[token]/route.ts",
    "components/CustomVerificationModelsPanel.tsx",
    "lib/api/agent-api-paths.ts",
    "lib/pow-api/agent-tool-surface.ts",
    "lib/pow-api/mcp-proof-of-work-server.ts",
    "docs/PROOF_OF_WORK_API.md",
  ];

  it("no alatap/alaTAP identifiers on goal-touched paths", () => {
    for (const rel of touched) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(true);
      const src = read(rel);
      expect(src, rel).not.toMatch(/alatap|alaTAP/i);
    }
  });
});
