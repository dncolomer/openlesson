/**
 * Admin product-tool labels: four variants from product-intent, not TAP/ILE branding.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import {
  ADMIN_SESSION_HORIZON_LABELS,
  adminActiveUserActivityLabel,
  adminActivityTypeLabel,
  adminProductIntentLabels,
  adminSessionProductLabel,
  adminSessionProductTarget,
  adminTimedSessionActivitySummary,
} from "@/lib/admin/product-labels";
import {
  activityTypeLabel,
  activityTypeLabelForEvent,
  mergeActivityEvents,
} from "@/lib/admin/activity";
import { PRODUCT_INTENT_LABELS } from "@/lib/product-intent";

const root = join(__dirname, "../..");

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("adminSessionProductTarget / Label (shipped helpers)", () => {
  it("maps ile/learning → Explore · Dialog", () => {
    const t = adminSessionProductTarget({
      technicalKind: "ile",
      session_mode: "learning",
    });
    expect(t.id).toBe("explore_dialog");
    expect(adminSessionProductLabel({ technicalKind: "ile", session_mode: "learning" })).toBe(
      PRODUCT_INTENT_LABELS.exploreDialog,
    );
  });

  it("maps ile/project → Explore · Solo Exercise", () => {
    expect(
      adminSessionProductLabel({ technicalKind: "ile", session_mode: "project" }),
    ).toBe(PRODUCT_INTENT_LABELS.exploreSolo);
    expect(
      adminSessionProductTarget({ technicalKind: "tutoring", session_mode: "exercise" }).id,
    ).toBe("explore_solo");
  });

  it("maps tap/conversational → Drill · Dialog", () => {
    expect(
      adminSessionProductLabel({
        technicalKind: "tap",
        interaction_kind: "conversational",
      }),
    ).toBe(PRODUCT_INTENT_LABELS.drillDialog);
  });

  it("maps tap/exercise → Drill · Solo Exercise", () => {
    expect(
      adminSessionProductLabel({ technicalKind: "tap", interaction_kind: "exercise" }),
    ).toBe(PRODUCT_INTENT_LABELS.drillSolo);
  });

  it("sparse missing-subtype cases still yield non-TAP/ILE product labels", () => {
    const ileSparse = adminSessionProductLabel({ technicalKind: "ile" });
    const tapSparse = adminSessionProductLabel({ technicalKind: "tap" });
    expect(ileSparse).toBe(PRODUCT_INTENT_LABELS.exploreDialog);
    expect(tapSparse).toBe(PRODUCT_INTENT_LABELS.drillDialog);
    for (const label of [ileSparse, tapSparse]) {
      expect(label).not.toMatch(/\bTAP\b|\bILE\b/i);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("exports the four product-intent display names", () => {
    const labels = adminProductIntentLabels();
    expect(labels.exploreDialog).toBe(PRODUCT_INTENT_LABELS.exploreDialog);
    expect(labels.exploreSolo).toBe(PRODUCT_INTENT_LABELS.exploreSolo);
    expect(labels.drillDialog).toBe(PRODUCT_INTENT_LABELS.drillDialog);
    expect(labels.drillSolo).toBe(PRODUCT_INTENT_LABELS.drillSolo);
  });
});

describe("admin activity type + summary labels", () => {
  it("family rollups when subtype absent; full names when present", () => {
    expect(adminActivityTypeLabel("ile_session")).toBe("Explore session");
    expect(adminActivityTypeLabel("tap_session")).toBe("Drill session");
    expect(
      adminActivityTypeLabel("ile_session", {
        session_mode: "project",
        preferFullProductName: true,
      }),
    ).toBe(PRODUCT_INTENT_LABELS.exploreSolo);
    expect(
      adminActivityTypeLabel("tap_session", {
        interaction_kind: "exercise",
        preferFullProductName: true,
      }),
    ).toBe(PRODUCT_INTENT_LABELS.drillSolo);
  });

  it("activityTypeLabel and activityTypeLabelForEvent use shipped mapping", () => {
    expect(activityTypeLabel("ile_session")).toBe(adminActivityTypeLabel("ile_session"));
    expect(
      activityTypeLabelForEvent({
        type: "tap_session",
        interaction_kind: "exercise",
        session_mode: null,
      }),
    ).toBe(PRODUCT_INTENT_LABELS.drillSolo);
  });

  it("drill session activity summary includes product name and optional score", () => {
    expect(
      adminTimedSessionActivitySummary({
        interaction_kind: "conversational",
        overall_score: 82,
      }),
    ).toBe(`${PRODUCT_INTENT_LABELS.drillDialog} · score 82`);
    expect(adminTimedSessionActivitySummary({ interaction_kind: "exercise" })).toBe(
      PRODUCT_INTENT_LABELS.drillSolo,
    );
    expect(adminTimedSessionActivitySummary({})).not.toMatch(/\bTAP\b|\bILE\b/);
  });

  it("active user activity summary uses open-ended / timed wording", () => {
    const label = adminActiveUserActivityLabel({
      ileSessions: 2,
      tapSessions: 1,
      proofOfWork: 3,
      workspacesCreated: 1,
    });
    expect(label).toBe("2 explore · 1 drill · 3 PoW · 1 WS");
    expect(label).not.toMatch(/\bTAP\b|\bILE\b/);
    expect(adminActiveUserActivityLabel({
      ileSessions: 0,
      tapSessions: 0,
      proofOfWork: 0,
      workspacesCreated: 0,
    })).toBe("—");
  });

  it("mergeActivityEvents preserves interaction_kind for product labels", () => {
    const events = mergeActivityEvents(
      [
        {
          id: "t1",
          type: "tap_session",
          createdAt: "2026-07-17T13:00:00.000Z",
          summary: adminTimedSessionActivitySummary({ interaction_kind: "exercise" }),
          href: "/admin/sessions/t1",
          userId: "u1",
          interaction_kind: "exercise",
        },
      ],
      new Map([["u1", { id: "u1", username: "a", email: null }]]),
      10,
    );
    expect(events[0].interaction_kind).toBe("exercise");
    expect(activityTypeLabelForEvent(events[0])).toBe(PRODUCT_INTENT_LABELS.drillSolo);
    expect(events[0].summary).toBe(PRODUCT_INTENT_LABELS.drillSolo);
  });
});

describe("admin UI/copy sources avoid TAP/ILE product branding", () => {
  it("admin app/lib surfaces do not brand sessions as TAP/ILE product names", () => {
    const dirs = [
      join(root, "app/admin"),
      join(root, "lib/admin"),
      join(root, "app/api/admin"),
    ];
    // Operator-facing product branding patterns (not technical kind keys like ile_session)
    const productBrandLine =
      /\bILE sessions\b|\bTAP sessions\b|"ILE session"|'ILE session'|"TAP session"|'TAP session'|Think Aloud Protocol|\$1\/TAP|\$10\/ILE/;

    const offenders: string[] = [];
    for (const dir of dirs) {
      for (const file of walkFiles(dir)) {
        const src = readFileSync(file, "utf8");
        const rel = file.slice(root.length + 1);
        const lines = src.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!productBrandLine.test(line)) continue;
          // Skip pure technical identifiers / table names without product branding phrases
          if (
            /ileSessions|tapSessions|totalIleSessions|totalTapSessions|workspace_tap_sessions|ile_session|tap_session|getTapSession/.test(
              line,
            ) &&
            !/\bILE sessions\b|\bTAP sessions\b|Think Aloud|\$1\/TAP|\$10\/ILE|"ILE session"|"TAP session"/.test(
              line,
            )
          ) {
            continue;
          }
          offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("family rollup labels are product-facing (Explore / Drill)", () => {
    expect(ADMIN_SESSION_HORIZON_LABELS.openEnded).toBe("Explore sessions");
    expect(ADMIN_SESSION_HORIZON_LABELS.timed).toBe("Drill sessions");
    expect(ADMIN_SESSION_HORIZON_LABELS.openEnded).not.toMatch(/TAP|ILE/);
    expect(ADMIN_SESSION_HORIZON_LABELS.timed).not.toMatch(/TAP|ILE/);
  });
});
