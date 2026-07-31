/**
 * Region builder: filter human PoW vs tapbench PoW and by link / TAPBench link.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertTapbenchOnlySelection,
  enrichSubjectWithPowProvenance,
  filterRegionBuilderSubjects,
  normalizeRegionBuilderSourceFilter,
  regionBuilderSubjectKey,
  selectSubjectsForRegion,
  type RegionBuilderSubject,
} from "@/lib/pow-api/region-builder";
import {
  buildStashDecisionMetadata,
  type StashTapbenchContext,
} from "@/lib/pow-api/stash-api";
import { classifyPowSource, isTapbenchPowMetadata } from "@/lib/pow-api/tapbench";

const ROOT = join(__dirname, "../..");

const tapbenchCtx: StashTapbenchContext = {
  linkId: "tb-link-aaa",
  exercise: "Exercise: Solve graph traversal out loud.",
  expires_at: new Date(Date.now() + 60_000).toISOString(),
  remaining_ms: 60_000,
  duration_seconds: 900,
  session_token: "tok",
  block_id: null,
  workspace_id: "ws-1",
  guest_user_id: "33333333-3333-4333-8333-333333333333",
};

function subject(
  partial: Partial<RegionBuilderSubject> & {
    user_id?: string | null;
    guest_user_id?: string | null;
  },
): RegionBuilderSubject {
  return {
    user_id: partial.user_id ?? null,
    guest_user_id: partial.guest_user_id ?? null,
    pow_source: partial.pow_source ?? "human",
    source_link_id: partial.source_link_id ?? null,
    source_link_url: partial.source_link_url ?? null,
    confidence: partial.confidence ?? 0.8,
    label: partial.label ?? null,
  };
}

describe("region builder filters (shipped helpers)", () => {
  const subjects: RegionBuilderSubject[] = [
    subject({
      user_id: "user-human",
      pow_source: "human",
      source_link_id: "tap-link-1",
      source_link_url: "https://app/tap/session/tok1",
      label: "Human A",
    }),
    subject({
      guest_user_id: "guest-tb",
      pow_source: "tapbench",
      source_link_id: "tb-link-aaa",
      source_link_url: "https://app/tapbench/tb_tok",
      label: "Tapbench B",
    }),
    subject({
      guest_user_id: "guest-tb-2",
      pow_source: "tapbench",
      source_link_id: "tb-link-bbb",
      source_link_url: "https://app/tapbench/other",
      label: "Tapbench C",
    }),
  ];

  it("filters to human PoW only", () => {
    const out = filterRegionBuilderSubjects(subjects, { source: "human" });
    expect(out).toHaveLength(1);
    expect(out[0].user_id).toBe("user-human");
    expect(out.every((s) => s.pow_source === "human")).toBe(true);
  });

  it("filters to tapbench PoW only", () => {
    const out = filterRegionBuilderSubjects(subjects, { source: "tapbench" });
    expect(out).toHaveLength(2);
    expect(out.every((s) => s.pow_source === "tapbench")).toBe(true);
  });

  it("filters by link / TAPBench link id", () => {
    const byId = filterRegionBuilderSubjects(subjects, {
      source: "all",
      linkQuery: "tb-link-aaa",
    });
    expect(byId).toHaveLength(1);
    expect(byId[0].source_link_id).toBe("tb-link-aaa");
  });

  it("filters by TAPBench share URL substring", () => {
    const byUrl = filterRegionBuilderSubjects(subjects, {
      source: "tapbench",
      linkQuery: "tapbench/tb_tok",
    });
    expect(byUrl).toHaveLength(1);
    expect(byUrl[0].guest_user_id).toBe("guest-tb");
  });

  it("filters by full listable share URL operators copy (source_link_url populated)", () => {
    const fullUrl = "https://app/tapbench/tb_tok";
    const byFull = filterRegionBuilderSubjects(subjects, {
      source: "all",
      linkQuery: fullUrl,
    });
    expect(byFull).toHaveLength(1);
    expect(byFull[0].source_link_url).toBe(fullUrl);
    // enrichSubjectWithPowProvenance attaches URL from link map
    const tbMeta = buildStashDecisionMetadata("submit", {}, tapbenchCtx);
    const enriched = enrichSubjectWithPowProvenance(
      { guest_user_id: "g-url" },
      [tbMeta],
      { "tb-link-aaa": fullUrl },
    );
    expect(enriched.source_link_url).toBe(fullUrl);
    expect(
      filterRegionBuilderSubjects([enriched], { source: "tapbench", linkQuery: "tapbench/tb_tok" }),
    ).toHaveLength(1);
  });

  it("region built from tapbench-only selection only includes those subjects", () => {
    const selected = selectSubjectsForRegion(subjects, { source: "tapbench" });
    expect(assertTapbenchOnlySelection(selected)).toBe(true);
    expect(selected.map((s) => s.guest_user_id).sort()).toEqual([
      "guest-tb",
      "guest-tb-2",
    ]);
    // Selecting a subset key still respects source filter
    const keys = new Set([regionBuilderSubjectKey(subjects[1])]);
    const subset = selectSubjectsForRegion(subjects, { source: "tapbench" }, keys);
    expect(subset).toHaveLength(1);
    expect(subset[0].source_link_id).toBe("tb-link-aaa");
  });

  it("enrichSubjectWithPowProvenance uses real stash metadata classification", () => {
    const tbMeta = buildStashDecisionMetadata("submit", {}, tapbenchCtx);
    const humanMeta = buildStashDecisionMetadata("stash", { source: "stash_api" });
    expect(isTapbenchPowMetadata(tbMeta)).toBe(true);
    expect(classifyPowSource(humanMeta)).toBe("human");

    const enrichedTb = enrichSubjectWithPowProvenance(
      { guest_user_id: "g1" },
      [tbMeta],
      { "tb-link-aaa": "https://app/tapbench/x" },
    );
    expect(enrichedTb.pow_source).toBe("tapbench");
    expect(enrichedTb.source_link_id).toBe("tb-link-aaa");
    expect(enrichedTb.source_link_url).toBe("https://app/tapbench/x");

    const enrichedHuman = enrichSubjectWithPowProvenance({ user_id: "u1" }, [humanMeta]);
    expect(enrichedHuman.pow_source).toBe("human");
  });

  it("normalizeRegionBuilderSourceFilter accepts aliases", () => {
    expect(normalizeRegionBuilderSourceFilter("tapbench")).toBe("tapbench");
    expect(normalizeRegionBuilderSourceFilter("human_pow")).toBe("human");
    expect(normalizeRegionBuilderSourceFilter("nope")).toBe("all");
  });
});

describe("region builder UI + API surface", () => {
  it("panel exposes human vs tapbench filters and TAPBench mint; synthetic create removed", () => {
    const ui = readFileSync(join(ROOT, "components/CustomVerificationModelsPanel.tsx"), "utf8");
    expect(ui).toContain("data-region-builder");
    expect(ui).toContain("data-region-source-filter");
    expect(ui).toContain("data-region-link-filter");
    expect(ui).toContain('value="human"');
    expect(ui).toContain('value="tapbench"');
    expect(ui).toContain("filterRegionBuilderSubjects");
    expect(ui).not.toContain("create_synthetic");
    expect(ui).not.toContain("FileDropZone");
  });

  it("region-builder module exists", () => {
    expect(existsSync(join(ROOT, "lib/pow-api/region-builder.ts"))).toBe(true);
  });

  it("listSubjectsWithKnowledgeConfig returns source_link_url and buildWorkspaceLinkUrlMap exists", () => {
    const store = readFileSync(
      join(ROOT, "lib/pow-api/custom-verification-model-store.ts"),
      "utf8",
    );
    expect(store).toContain("source_link_url");
    expect(store).toContain("buildWorkspaceLinkUrlMap");
    expect(store).toContain("buildTapbenchShareUrl");
    const route = readFileSync(
      join(ROOT, "app/api/workspace/custom-knowledge-regions/route.ts"),
      "utf8",
    );
    expect(route).toContain("baseUrl");
    expect(route).toContain("listSubjectsWithKnowledgeConfig");
  });
});
