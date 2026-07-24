import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  dryRunCollapsePricingMigration,
  isRemovedPaidPlanId,
  migratePlanRows,
} from "@/lib/organization/migrate-plan-ids";
import { migratePlanIdToCurrent } from "@/lib/plans";

const ROOT = join(__dirname, "../..");

describe("plan id collapse migration", () => {
  it("SQL migration rewrites removed tiers to api_metered and leaves trial/inactive alone", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20260724150000_collapse_plans_to_api_metered.sql"),
      "utf8"
    );
    expect(sql).toMatch(/plan = 'api_metered'/);
    expect(sql).toMatch(/regular_2026/);
    expect(sql).toMatch(/pro_teams/);
    expect(sql).toMatch(/UPDATE public\.organizations/);
    expect(sql).toMatch(/UPDATE public\.profiles/);
    // Must not touch trial / inactive in the WHERE (only removed ids)
    expect(sql).toMatch(
      /WHERE plan IN \('regular_2026', 'pro_teams', 'regular', 'pro'\)/
    );
  });

  it("dry-run fixtures: removed paid → api_metered; trial/inactive/metered unchanged", () => {
    const results = dryRunCollapsePricingMigration();
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));

    expect(byId["org-individual"]).toMatchObject({
      from: "regular_2026",
      to: "api_metered",
      changed: true,
    });
    expect(byId["org-teams"]).toMatchObject({
      from: "pro_teams",
      to: "api_metered",
      changed: true,
    });
    expect(byId["org-legacy-regular"].to).toBe("api_metered");
    expect(byId["org-legacy-pro"].to).toBe("api_metered");
    expect(byId["org-trial"]).toMatchObject({ from: "trial", to: "trial", changed: false });
    expect(byId["org-inactive"]).toMatchObject({
      from: "inactive",
      to: "inactive",
      changed: false,
    });
    expect(byId["org-metered"]).toMatchObject({
      from: "api_metered",
      to: "api_metered",
      changed: false,
    });
    expect(byId["profile-teams"].to).toBe("api_metered");
  });

  it("migratePlanRows and isRemovedPaidPlanId use shared migratePlanIdToCurrent", () => {
    expect(isRemovedPaidPlanId("regular_2026")).toBe(true);
    expect(isRemovedPaidPlanId("pro_teams")).toBe(true);
    expect(isRemovedPaidPlanId("api_metered")).toBe(false);
    expect(isRemovedPaidPlanId("trial")).toBe(false);

    const rows = migratePlanRows([
      { id: "a", plan: "pro_teams" },
      { id: "b", plan: "trial" },
    ]);
    expect(rows[0].to).toBe(migratePlanIdToCurrent("pro_teams"));
    expect(rows[1].changed).toBe(false);
  });
});
