/**
 * Region builder: live filter is all | human. Historical tapbench provenance is classified.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  enrichSubjectWithPowProvenance,
  filterRegionBuilderSubjects,
  normalizeRegionBuilderSourceFilter,
  regionBuilderSubjectKey,
  selectSubjectsForRegion,
  type RegionBuilderSubject,
} from "@/lib/pow-api/region-builder";
import { classifyPowSource, isTapbenchPowMetadata } from "@/lib/pow-api/tapbench";

const ROOT = join(__dirname, "../..");

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

  it("does not treat tapbench as a live source filter", () => {
    expect(normalizeRegionBuilderSourceFilter("tapbench")).toBe("all");
    const out = filterRegionBuilderSubjects(subjects, { source: "all" });
    expect(out.some((s) => s.pow_source === "tapbench")).toBe(true);
    expect(out.some((s) => s.pow_source === "human")).toBe(true);
  });

  it("filters by TAP / TAP Learning link id", () => {
    const byId = filterRegionBuilderSubjects(subjects, {
      source: "all",
      linkQuery: "tb-link-aaa",
    });
    expect(byId).toHaveLength(1);
    expect(byId[0].source_link_id).toBe("tb-link-aaa");
  });

  it("filters by historical share URL substring without a live tapbench source option", () => {
    const byUrl = filterRegionBuilderSubjects(subjects, {
      source: "all",
      linkQuery: "tb_tok",
    });
    expect(byUrl).toHaveLength(1);
    expect(byUrl[0].guest_user_id).toBe("guest-tb");
  });

  it("filters by full listable share URL operators copy (source_link_url populated)", () => {
    const fullUrl = "https://app/tap/session/tok1";
    const byFull = filterRegionBuilderSubjects(subjects, {
      source: "all",
      linkQuery: fullUrl,
    });
    expect(byFull).toHaveLength(1);
    expect(byFull[0].source_link_url).toBe(fullUrl);
    const humanMeta = { source_link_id: "tap-link-1" };
    const enriched = enrichSubjectWithPowProvenance(
      { user_id: "u-url" },
      [humanMeta],
      { "tap-link-1": fullUrl },
    );
    expect(enriched.source_link_url).toBe(fullUrl);
    expect(
      filterRegionBuilderSubjects([enriched], { source: "human", linkQuery: "tap/session/tok1" }),
    ).toHaveLength(1);
  });

  it("region built from human selection only includes those subjects", () => {
    const selected = selectSubjectsForRegion(subjects, { source: "human" });
    expect(selected.every((s) => s.pow_source === "human")).toBe(true);
    expect(selected.map((s) => s.user_id)).toEqual(["user-human"]);
    const keys = new Set([regionBuilderSubjectKey(subjects[0])]);
    const subset = selectSubjectsForRegion(subjects, { source: "human" }, keys);
    expect(subset).toHaveLength(1);
    expect(subset[0].source_link_id).toBe("tap-link-1");
  });

  it("enrichSubjectWithPowProvenance classifies historical tapbench metadata without minting", () => {
    const tbMeta = {
      tapbench: true,
      tapbench_link_id: "tb-link-aaa",
      source_link_id: "tb-link-aaa",
    };
    const humanMeta = { source: "human" };
    expect(isTapbenchPowMetadata(tbMeta)).toBe(true);
    expect(classifyPowSource(humanMeta)).toBe("human");

    const enrichedTb = enrichSubjectWithPowProvenance(
      { guest_user_id: "g1" },
      [tbMeta],
      { "tb-link-aaa": "https://example.invalid/historical" },
    );
    expect(enrichedTb.pow_source).toBe("tapbench");
    expect(enrichedTb.source_link_id).toBe("tb-link-aaa");

    const enrichedHuman = enrichSubjectWithPowProvenance({ user_id: "u1" }, [humanMeta]);
    expect(enrichedHuman.pow_source).toBe("human");
  });

  it("normalizeRegionBuilderSourceFilter accepts human aliases and ignores tapbench", () => {
    expect(normalizeRegionBuilderSourceFilter("tapbench")).toBe("all");
    expect(normalizeRegionBuilderSourceFilter("human_pow")).toBe("human");
    expect(normalizeRegionBuilderSourceFilter("nope")).toBe("all");
  });
});

describe("region builder UI + API surface", () => {
  it("panel exposes human PoW filter and does not offer TAPBench as a live source", () => {
    const ui = readFileSync(join(ROOT, "components/CustomVerificationModelsPanel.tsx"), "utf8");
    expect(ui).toContain("data-region-builder");
    expect(ui).toContain("data-region-source-filter");
    expect(ui).toContain("data-region-link-filter");
    expect(ui).toContain('value="human"');
    expect(ui).not.toContain('value="tapbench"');
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
    expect(store).not.toContain("buildTapbenchShareUrl");
    expect(store).not.toContain("workspace_tapbench_links");
    const route = readFileSync(
      join(ROOT, "app/api/workspace/custom-knowledge-regions/route.ts"),
      "utf8",
    );
    expect(route).toContain("baseUrl");
    expect(route).toContain("listSubjectsWithKnowledgeConfig");
  });
});
