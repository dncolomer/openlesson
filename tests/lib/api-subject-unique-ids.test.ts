import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readKnowledgePanelSurface } from "../helpers/surface-source";
import { resolveEvaluationSubject } from "@/lib/pow-api/evaluation-subject";
import { resolveModelsTabScope } from "@/lib/pow-api/models-tab-scope";
import type { AuthContext } from "@/lib/pow-api/types";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function auth(partial: Partial<AuthContext> = {}): AuthContext {
  return {
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    guest_user_id: null,
    organization_id: "org-1",
    is_org_admin: false,
    key_id: "key-1",
    scopes: ["workspaces:read"],
    ...partial,
  };
}

const ME = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("API subject unique IDs (no subject=me)", () => {
  it("resolveEvaluationSubject requires unique user_id; ignores me token", () => {
    expect(resolveEvaluationSubject(auth(), { user_id: ME })).toEqual({ user_id: ME });
    expect(resolveEvaluationSubject(auth(), {})).toEqual({ user_id: ME });
    // Deprecated token does not change resolution.
    expect(resolveEvaluationSubject(auth(), { subject: "me" })).toEqual({ user_id: ME });
    expect(resolveEvaluationSubject(auth(), { subject: "self", user_id: OTHER })).toEqual({
      user_id: ME,
    });
    expect(
      resolveEvaluationSubject(auth({ is_org_admin: true }), { user_id: OTHER }),
    ).toEqual({ user_id: OTHER });
  });

  it("resolveModelsTabScope query always emits user_id UUID not subject=me", () => {
    const self = resolveModelsTabScope({
      mode: "user",
      currentUserId: ME,
      targetUserId: ME,
      canInspectOthers: true,
    });
    expect(self.query.user_id).toBe(ME);
    expect(self.query).not.toHaveProperty("subject");

    const other = resolveModelsTabScope({
      mode: "user",
      currentUserId: ME,
      targetUserId: OTHER,
      canInspectOthers: true,
    });
    expect(other.query.user_id).toBe(OTHER);
    expect(other.query).not.toHaveProperty("subject");
  });

  it("eval routes and docs do not prescribe subject=me self addressing", () => {
    const routes = [
      "app/api/v3/snapshot/workspaces/[id]/knowledge-distance/route.ts",
      "app/api/v3/snapshot/workspaces/[id]/knowledge-config/route.ts",
      "app/api/v3/snapshot/workspaces/[id]/world-model/route.ts",
      "app/api/v3/snapshot/workspaces/[id]/snapshot-history/route.ts",
      "app/api/workspace/snapshot-history/route.ts",
      "components/WorkspacePerformancePanel.tsx",
    ];
    for (const rel of routes) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(true);
      const src = read(rel);
      // No live request builders / defaults using the me token.
      expect(src, rel).not.toMatch(/params\.set\("subject", "me"\)/);
      expect(src, rel).not.toMatch(/subject:\s*typeof[^;]*["']me["']/);
      expect(src, rel).not.toMatch(/subject:\s*url\.searchParams\.get\("subject"\)/);
      expect(src, rel).not.toMatch(/subject:\s*["']me["']/);
    }

    const docs = read("docs/PROOF_OF_WORK_API.md");
    expect(docs).toMatch(/unique `user_id`/);
    expect(docs).toMatch(/no `subject=me`/);
    expect(docs).not.toMatch(/\?subject=me/);

    // Snapshot subject addressing lives in LWM panel (Eval tab removed).
    const lwm = readKnowledgePanelSurface();
    expect(lwm).toMatch(/params\.set\("user_id"/);
    expect(lwm).not.toMatch(/params\.set\("subject", "me"\)/);
  });
});
