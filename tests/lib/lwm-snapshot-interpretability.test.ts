/**
 * LWM Snapshot interpretability: field inventory + pure explain mapper.
 * Fixtures shaped like real VerticalScoreReport (shallow TAPBench-like vs richer).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  LWM_CLIENT_LABELS,
  LWM_SNAPSHOT_REQUIRED_INVENTORY_FIELDS,
  explainLwmSnapshotReport,
  listLwmSnapshotResponseFields,
  lwmPrimaryBandLabel,
} from "@/lib/pow-api/lwm-snapshot-interpretability";
import { SCORE_FIELD_DESCRIPTIONS } from "@/lib/prompt-kernel/scores";
import type { VerticalScoreReport } from "@/lib/pow-api/performance-report";

const ROOT = join(__dirname, "../..");

/** Shallow agent-like card: low skill, elevated GHC (motivation: 28 / 78). */
const SHALLOW_REPORT: VerticalScoreReport = {
  vertical: "verification",
  score: 28,
  lwm_snapshot_score: 28,
  workspace_goal: "Map computational skill evidence to Algorithms & Complexity.",
  ghc_score: 78,
  ghc_confidence: "medium",
  temporal_summary: "Short burst of four thought traces within one timed session.",
  marker_scores: [
    {
      id: "coverage",
      label: "Topic coverage",
      score: 32,
      rationale: "Only PATH membership touched; counting hardness sketched lightly.",
    },
    {
      id: "depth",
      label: "Reasoning depth",
      score: 25,
      rationale: "Brief boxed answers without worked examples or edge cases.",
    },
    {
      id: "evidence",
      label: "Evidence variety",
      score: 22,
      rationale: "Four short text traces only; no multi-session progression.",
    },
  ],
  summary:
    "Early evidence of graph-algorithm fluency: correct high-level claims but thin proof detail.",
  strengths: ["States PATH ∈ P with BFS intuition", "Mentions #P contrast"],
  growth_areas: ["Worked reductions", "Concrete complexity bounds"],
  gap_analysis: {
    summary: "Thin depth on algorithms claims despite structured thought traces.",
    gaps: [
      {
        title: "Shallow complexity arguments",
        severity: "high",
        proof_of_work: "Four short stash/submit thoughts",
        suggested_repair: "Add a full reduction or asymptotic derivation on a second problem.",
      },
    ],
    next_steps: {
      directions: ["Practice one #P-completeness sketch with a known source problem"],
      events: ["Upload a second multi-step solution with intermediate checks"],
    },
  },
  suggestions: ["Expand each claim into a short proof paragraph with an example graph."],
  confidence: "emerging",
};

/** Richer human-like card: stronger skill, moderate GHC. */
const RICHER_REPORT: VerticalScoreReport = {
  vertical: "verification",
  score: 72,
  lwm_snapshot_score: 72,
  workspace_goal: "Map computational skill evidence to Algorithms & Complexity.",
  ghc_score: 55,
  ghc_confidence: "high",
  marker_scores: [
    {
      id: "coverage",
      label: "Topic coverage",
      score: 70,
      rationale: "Multiple blocks of asymptotics and graphs with cross-links.",
    },
    {
      id: "depth",
      label: "Reasoning depth",
      score: 75,
      rationale: "Full proofs and counterexamples across sessions.",
    },
    {
      id: "transfer",
      label: "Transfer",
      score: 68,
      rationale: "Applies reductions to a new problem family.",
    },
  ],
  summary: "Solid demonstration of algorithms fluency with room to tighten crypto-adjacent edges.",
  strengths: ["Clear reductions", "Good use of System 2 commits"],
  growth_areas: ["Randomized algorithms edge cases"],
  gap_analysis: {
    summary: "Strong algorithms base; randomized analysis thinner.",
    gaps: [
      {
        title: "Limited randomized analysis",
        severity: "medium",
        proof_of_work: "Multi-session TAP with proofs on graphs",
        suggested_repair: "Add expectation calculation on a small hashing example.",
      },
    ],
    next_steps: {
      directions: ["One expectation exercise on hashing"],
      events: [],
    },
  },
  suggestions: ["Schedule a short drill on Chernoff-style bounds."],
  confidence: "clear",
};

describe("listLwmSnapshotResponseFields (API inventory)", () => {
  it("covers required report fields with plain-language labels (from shipped helper)", () => {
    const items = listLwmSnapshotResponseFields();
    const fields = new Set(items.map((i) => i.field));
    for (const req of LWM_SNAPSHOT_REQUIRED_INVENTORY_FIELDS) {
      expect(fields.has(req), `missing inventory field ${req}`).toBe(true);
    }
    const byField = Object.fromEntries(items.map((i) => [i.field, i]));
    expect(byField.score.client_label).toBe(LWM_CLIENT_LABELS.primary_score);
    expect(byField.ghc_score.client_label).toBe(LWM_CLIENT_LABELS.ghc_score);
    expect(byField.score.plain_language.length).toBeGreaterThan(40);
    expect(byField.ghc_score.plain_language.length).toBeGreaterThan(40);
    // Primary vs secondary roles for dual-score story
    expect(byField.score.role).toBe("primary");
    expect(byField.ghc_score.role).toBe("secondary");
    // Ties to shared score vocabulary (not a parallel copy-only list)
    expect(byField.lwm_snapshot_score.plain_language).toBe(
      SCORE_FIELD_DESCRIPTIONS.lwm_snapshot_score,
    );
  });

  it("docs and helper both mention dual scores in plain language", () => {
    const docs = join(ROOT, "docs/PROOF_OF_WORK_API.md");
    expect(existsSync(docs)).toBe(true);
    const text = readFileSync(docs, "utf8");
    expect(text).toMatch(/Skill \/ readiness|plain language/i);
    expect(text).toMatch(/Authenticity of work|ghc_score/i);
    expect(text).toMatch(/lwm-snapshot-interpretability/);
  });
});

describe("explainLwmSnapshotReport (pure mapper)", () => {
  it("maps shallow report scores/meanings from input (not hard-coded unrelated numbers)", () => {
    const explained = explainLwmSnapshotReport(SHALLOW_REPORT);
    expect(explained.primary_score).toBe(28);
    expect(explained.ghc_score).toBe(78);
    expect(explained.primary_label).toBe(LWM_CLIENT_LABELS.primary_score);
    expect(explained.ghc_label).toBe(LWM_CLIENT_LABELS.ghc_score);
    expect(explained.primary_meaning).toContain("28");
    expect(explained.ghc_meaning).toContain("78");
    expect(explained.ghc_confidence).toBe("medium");
    expect(explained.primary_band).toBe("low");
    expect(lwmPrimaryBandLabel(explained.primary_band)).toMatch(/Early/i);
    expect(explained.summary).toBe(SHALLOW_REPORT.summary);
    expect(explained.workspace_goal).toBe(SHALLOW_REPORT.workspace_goal);
    expect(explained.strengths).toEqual(SHALLOW_REPORT.strengths);
    expect(explained.growth_areas).toEqual(SHALLOW_REPORT.growth_areas);
    expect(explained.markers).toHaveLength(3);
    expect(explained.markers[0].label).toBe("Topic coverage");
    expect(explained.markers[0].score).toBe(32);
    expect(explained.markers[0].rationale).toContain("PATH");
    expect(explained.gaps[0].title).toBe("Shallow complexity arguments");
    expect(explained.next_step_directions[0]).toContain("#P");
    expect(explained.suggestions[0]).toContain("Expand");
    expect(explained.dual_score_note.toLowerCase()).toMatch(/skill|authenticity|ghc/);
    // Must not invent a different primary than the report
    expect(explained.primary_score).toBe(SHALLOW_REPORT.score);
    expect(explained.ghc_score).toBe(SHALLOW_REPORT.ghc_score);
  });

  it("maps richer report distinctly from shallow (scores come from each input)", () => {
    const explained = explainLwmSnapshotReport(RICHER_REPORT);
    expect(explained.primary_score).toBe(72);
    expect(explained.ghc_score).toBe(55);
    expect(explained.primary_band).toBe("strong");
    expect(explained.primary_meaning).toContain("72");
    expect(explained.ghc_meaning).toContain("55");
    expect(explained.markers.some((m) => m.label === "Transfer")).toBe(true);
    expect(explained.evidence_confidence).toBe("clear");
    // Divergence story still present
    expect(explained.dual_score_note.length).toBeGreaterThan(40);
  });

  it("handles empty/partial report without throwing", () => {
    const empty = explainLwmSnapshotReport(null);
    expect(empty.primary_score).toBeNull();
    expect(empty.ghc_score).toBeNull();
    expect(empty.primary_band).toBe("unknown");
    expect(empty.markers).toEqual([]);
    const partial = explainLwmSnapshotReport({
      score: 50,
      ghc_score: 40,
      ghc_confidence: "low",
      summary: "Halfway there",
    } as Partial<VerticalScoreReport>);
    expect(partial.primary_score).toBe(50);
    expect(partial.primary_band).toBe("moderate");
    expect(partial.summary).toBe("Halfway there");
  });
});
