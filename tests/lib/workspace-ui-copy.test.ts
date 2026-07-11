import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");

const IN_SCOPE_UI_FILES = [
  "app/workspace/new/page.tsx",
  "app/docs/proof-of-work-api/page.tsx",
  "app/docs/proof-of-work-api/layout.tsx",
  "app/layout.tsx",
  "app/manifest.ts",
  "app/opengraph-image.tsx",
  "lib/seo/platform-page.ts",
  "lib/sales/platform-pitch-deck.ts",
  ...fs.readdirSync(path.join(REPO_ROOT, "messages")).map((file) => `messages/${file}`),
];

const OUT_OF_SCOPE_FILES_WITH_LEGACY_COPY = [
  "skill.md",
  "public/skill.md",
  "lib/agent-v2/create-verification-workspace.ts",
  "app/api/v2/agent/workspaces/route.ts",
];

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("Workspace UI copy rename", () => {
  it("removes Verification Workspace phrasing from user-facing UI surfaces", () => {
    const offenders = IN_SCOPE_UI_FILES.filter((file) =>
      readRepoFile(file).includes("Verification Workspace"),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps Verification Workspace phrasing in API and agent integration surfaces", () => {
    for (const file of OUT_OF_SCOPE_FILES_WITH_LEGACY_COPY) {
      expect(readRepoFile(file)).toContain("Verification Workspace");
    }
  });
});