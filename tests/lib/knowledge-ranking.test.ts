/**
 * Pure Knowledge Ranking: latest-per-subject Snapshot + GHC, ordered leaderboard.
 * Drives the shipped helpers in lib/pow-api/knowledge-ranking.ts.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readKnowledgePanelSurface } from "../helpers/surface-source";
import {
  buildKnowledgeRanking,
  formatRankingScore,
  knowledgeRankingSubjectKey,
  latestSnapshotRunBySubject,
} from "@/lib/pow-api/knowledge-ranking";

const ROOT = join(__dirname, "../..");

describe("knowledgeRankingSubjectKey", () => {
  it("prefers guest over user and formats u:/g: keys", () => {
    expect(knowledgeRankingSubjectKey({ user_id: "u1" })).toBe("u:u1");
    expect(knowledgeRankingSubjectKey({ guest_user_id: "g1" })).toBe("g:g1");
    expect(
      knowledgeRankingSubjectKey({ user_id: "u1", guest_user_id: "g1" }),
    ).toBe("g:g1");
    expect(
      knowledgeRankingSubjectKey({
        subject_user_id: "u2",
        subject_guest_user_id: null,
      }),
    ).toBe("u:u2");
  });
});

describe("latestSnapshotRunBySubject + buildKnowledgeRanking", () => {
  const runs = [
    {
      id: "old-a",
      ran_at: "2026-07-01T12:00:00.000Z",
      score: 40,
      ghc_score: 30,
      subject_user_id: "alice",
      subject_guest_user_id: null,
      vertical: "verification",
    },
    {
      id: "new-a",
      ran_at: "2026-07-20T12:00:00.000Z",
      score: 88,
      ghc_score: 70,
      subject_user_id: "alice",
      subject_guest_user_id: null,
      vertical: "verification",
      report: {
        score: 88,
        strengths: ["Clear reasoning"],
        gap_analysis: { summary: "Gaps", gaps: [{ title: "Depth" }] },
        marker_scores: [{ id: "m1", label: "Depth", score: 70 }],
      },
    },
    {
      id: "bob-only",
      ran_at: "2026-07-15T12:00:00.000Z",
      score: 95,
      ghc_score: null,
      subject_user_id: "bob",
      subject_guest_user_id: null,
      vertical: "verification",
    },
    {
      id: "guest-run",
      ran_at: "2026-07-18T12:00:00.000Z",
      score: 60,
      ghc_score: 55,
      subject_user_id: null,
      subject_guest_user_id: "guest-1",
      vertical: "verification",
    },
  ];

  it("keeps only the newest run per subject", () => {
    const map = latestSnapshotRunBySubject(runs);
    expect(map.get("u:alice")?.id).toBe("new-a");
    expect(map.get("u:bob")?.id).toBe("bob-only");
    expect(map.get("g:guest-1")?.id).toBe("guest-run");
    expect(map.size).toBe(3);
  });

  it("orders cards by snapshot score desc and keeps both scores", () => {
    const cards = buildKnowledgeRanking({
      subjects: [
        { user_id: "alice", label: "Alice" },
        { user_id: "bob", label: "Bob" },
        { guest_user_id: "guest-1", label: "Casey" },
        { user_id: "carol", label: "Carol" }, // no snapshot
      ],
      runs,
      currentUserId: "alice",
    });

    expect(cards.map((c) => c.label)).toEqual(["Bob", "Alice", "Casey", "Carol"]);
    expect(cards[0].rank).toBe(1);
    expect(cards[0].snapshotScore).toBe(95);
    expect(cards[0].ghcScore).toBeNull(); // missing GHC → null, not 0
    expect(cards[1].snapshotScore).toBe(88);
    expect(cards[1].ghcScore).toBe(70);
    expect(cards[1].runId).toBe("new-a"); // latest, not old-a
    expect(cards[1].report).toMatchObject({ score: 88, strengths: ["Clear reasoning"] });
    expect(cards[2].snapshotScore).toBe(60);
    expect(cards[3].hasSnapshot).toBe(false);
    expect(cards[3].snapshotScore).toBeNull();
    expect(cards[3].ghcScore).toBeNull();
    expect(cards[3].report).toBeNull();
  });

  it("formatRankingScore shows em dash for missing", () => {
    expect(formatRankingScore(88)).toBe("88");
    expect(formatRankingScore(null)).toBe("—");
    expect(formatRankingScore(undefined)).toBe("—");
  });
});

describe("Knowledge Ranking surface wiring", () => {
  it("ranking view is gone; helper stays for snapshot history consumers", () => {
    const panel = join(ROOT, "components/WorkspacePerformancePanel.tsx");
    const traj = join(ROOT, "components/KnowledgeConfigTrajectoryPanel.tsx");
    const helper = join(ROOT, "lib/pow-api/knowledge-ranking.ts");
    expect(existsSync(panel)).toBe(true);
    expect(existsSync(traj)).toBe(true);
    expect(existsSync(helper)).toBe(true);
    expect(existsSync(join(ROOT, "components/knowledge-panel/ranking-view.tsx"))).toBe(false);

    const panelSrc = readFileSync(panel, "utf8");
    const trajSrc = readKnowledgePanelSurface();

    expect(panelSrc).not.toContain('panelView="ranking"');
    expect(panelSrc).not.toContain("performanceSubTabRanking");
    expect(trajSrc).not.toContain('panelView === "ranking"');
    expect(trajSrc).not.toContain('data-section="ranking"');
    expect(trajSrc).toContain('data-section="embeddings-projections"');
  });
});
