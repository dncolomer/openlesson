/**
 * Goals-aware eligibility resolution + goals API access control structural tests.
 * Drives shipped resolveGoalsForEligibility pure paths and source contracts.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fingerprintGoals,
  resolveEvaluatedGoals,
  parseGoalSelectionFromBody,
  type GoalCatalogEntry,
} from "@/lib/pow-api/goals";
import {
  canAccessWorkspaceEval,
  resolveEvalPersistenceClientMode,
} from "@/lib/pow-api/evaluation-subject";

const ROOT = join(__dirname, "../..");

describe("eligibility gate is goals-set identity (product criterion 3)", () => {
  const catalogWs: GoalCatalogEntry[] = [
    { id: "wg-1", text: "Ship API", scope: "workspace" },
  ];
  const catalogBl: GoalCatalogEntry[] = [
    { id: "bg-1", text: "Auth mastery", scope: "block", block_id: "b1" },
  ];

  it("after adhoc snapshot, default goals fingerprint is distinct → allowed without new PoW", () => {
    const adhoc = resolveEvaluatedGoals({
      selection: parseGoalSelectionFromBody({
        goal_mode: "adhoc",
        adhoc_goal: "One-off demo",
      }),
      workspaceGoals: catalogWs,
      blockGoals: catalogBl,
    });
    const defaults = resolveEvaluatedGoals({
      selection: { mode: "default" },
      workspaceGoals: catalogWs,
      blockGoals: catalogBl,
      powRelatedBlockIds: ["b1"],
    });
    const adhocFp = fingerprintGoals(adhoc);
    const defaultFp = fingerprintGoals(defaults);
    expect(adhocFp).not.toBe(defaultFp);
  });

  it("custom selection vs default are distinct identities", () => {
    const custom = resolveEvaluatedGoals({
      selection: { mode: "selected", goal_ids: ["wg-1"] },
      workspaceGoals: catalogWs,
      blockGoals: catalogBl,
    });
    const defaults = resolveEvaluatedGoals({
      selection: { mode: "default" },
      workspaceGoals: catalogWs,
      blockGoals: catalogBl,
      powRelatedBlockIds: ["b1"],
    });
    expect(fingerprintGoals(custom)).not.toBe(fingerprintGoals(defaults));
  });
});

describe("goals GET access control (no open admin list)", () => {
  it("canAccessWorkspaceEval denies non-owners (basis for goals read)", () => {
    expect(
      canAccessWorkspaceEval({
        callerUserId: "user-a",
        workspaceOwnerId: "owner-b",
      }).allowed,
    ).toBe(false);
    expect(
      resolveEvalPersistenceClientMode(
        canAccessWorkspaceEval({
          callerUserId: "user-a",
          workspaceOwnerId: "owner-b",
        }),
      ),
    ).toBe("deny");
    expect(
      canAccessWorkspaceEval({
        callerUserId: "owner-b",
        workspaceOwnerId: "owner-b",
      }).isOwner,
    ).toBe(true);
  });

  it("workspace goals route uses canAccessWorkspaceEval and never soft-opens admin to any session", () => {
    const src = readFileSync(join(ROOT, "app/api/workspace/goals/route.ts"), "utf8");
    expect(src).toContain("requireProductWorkspaceEvalAuth");
    expect(src).toContain('mode: "read"');
    expect(src).toContain("auth.subjectId");
    expect(src).toContain('action: "author"');
    // No unauthenticated-soft path that lists via admin for any logged-in user
    expect(src).not.toMatch(
      /allow authenticated users to list for LWM|Soften: allow authenticated/i,
    );
    expect(src).not.toContain("actingUser");
    expect(src).not.toMatch(/isOwner:\s*true/);
  });

  it("block goals GET uses the same access gate", () => {
    const src = readFileSync(
      join(ROOT, "app/api/workspace/block-goals/route.ts"),
      "utf8",
    );
    expect(src).toContain("canAccessWorkspaceEval");
    expect(src).toContain("resolveEvalPersistenceClientMode");
    expect(src).not.toMatch(
      /const admin = createAdminClient\(\);\s*\n\s*const goals = await listBlockGoals\(admin/,
    );
  });
});

describe("goals eligibility helper", () => {
  it("goals-eligibility helper ships for default PoW-related resolution", () => {
    const src = readFileSync(
      join(ROOT, "lib/pow-api/goals-eligibility.ts"),
      "utf8",
    );
    expect(src).toContain("resolveGoalsForEligibility");
    expect(src).toContain("loadPowRelatedBlockIds");
    expect(src).toContain("resolveEvaluatedGoals");
  });
});
