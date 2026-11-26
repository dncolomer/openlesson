import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calibrateResultFromLegacyEvents,
  EMBEDDING_MODELS_V1,
  embeddingModelIdForFamily,
  FLOW_EMBEDDING_ALGORITHM_V1,
  isMapLearnSession,
  isSolveSession,
  parseSessionKind,
  parseSessionResult,
  parseSoundingClassification,
  SESSION_KINDS,
  solveFlowIdFromSession,
  VERIFY_EMBEDDING_MODEL_ID,
} from "@/lib/core-data-model";

const ROOT = join(__dirname, "../..");

describe("core data model contract", () => {
  it("registers the verification embedding family on the shared algorithm", () => {
    expect(EMBEDDING_MODELS_V1.map((row) => row.family)).toEqual(["verify"]);
    expect(EMBEDDING_MODELS_V1.every((row) => row.algorithmId === FLOW_EMBEDDING_ALGORITHM_V1)).toBe(
      true,
    );
    expect(embeddingModelIdForFamily("verify")).toBe(VERIFY_EMBEDDING_MODEL_ID);
    expect(VERIFY_EMBEDDING_MODEL_ID).toBe("verify-flowcfg-v1-d96");
    expect(SESSION_KINDS).toEqual(["learn", "verify"]);
  });

  it("parses Learn and Verify session results", () => {
    expect(
      parseSessionResult({
        kind: "learn",
        projectedPolicy: { sequence: ["r1", "root"], steps: 2, excess: 0, distance: 0 },
      }),
    ).toEqual({
      kind: "learn",
      projectedPolicy: { sequence: ["r1", "root"], steps: 2, excess: 0, distance: 0 },
    });
    expect(
      parseSessionResult({
        kind: "verify",
        projectedPolicy: { sequence: ["r1"], steps: 1, excess: 1, distance: 2 },
        knowledgeRegionId: "region-1",
      })?.kind,
    ).toBe("verify");
    expect(
      parseSessionResult({
        kind: "calibrate",
        uncertainQuestionIds: ["q1"],
      }),
    ).toBeNull();
    expect(parseSessionResult({ kind: "solve" })).toBeNull();
    expect(parseSessionKind("solve")).toBeNull();
    expect(parseSessionKind("verify")).toBe("verify");
    expect(isSolveSession({ kind: "solve", solve_flow_id: "sf1" })).toBe(true);
    expect(isMapLearnSession({ kind: "learn" })).toBe(true);
    expect(isMapLearnSession({ kind: "verify" })).toBe(false);
    expect(isSolveSession({ kind: "learn" })).toBe(false);
    expect(solveFlowIdFromSession({ solve_flow_id: "sf1" })).toBe("sf1");
    expect(solveFlowIdFromSession({ kind: "learn" })).toBeNull();
  });

  it("promotes staging sounding JSON strings into a Calibrate result", () => {
    const events = [
      {
        type: "sounding",
        source: "typed",
        questionId: "unranked",
        text: JSON.stringify({
          sounding: true,
          sounding_band: "unranked",
          sounding_coverage_depth: 0,
          sounding_reliability: "low",
          sounding_false_coverage: false,
          sounding_persistent_territories: [],
          sounding_taps: [
            { stillIds: ["a", "b"], tappedIds: ["a"] },
          ],
          sounding_proof_still: "a",
          sounding_proof_choice: "cant-tell",
          sounding_proof_transcript: null,
        }),
      },
    ];
    const result = calibrateResultFromLegacyEvents(events);
    expect(result?.kind).toBe("calibrate");
    expect(result?.uncertainQuestionIds).toEqual(["a"]);
    expect(result?.trustedQuestionIds).toEqual(["b"]);
    expect(result?.classification.band).toBe("unranked");
    expect(result?.expertProof?.choice).toBe("cant-tell");
  });

  it("rejects an unknown sounding band", () => {
    expect(parseSoundingClassification({ band: "expert" })).toBeNull();
  });

  it("keeps the contract document next to the types", () => {
    const path = join(ROOT, "docs/core-data-model.md");
    expect(existsSync(path)).toBe(true);
    const doc = readFileSync(path, "utf8");
    expect(doc).toContain("Embeddable Knowledge Verification Protocols");
    expect(doc).toContain("The Protocol Challenge");
    expect(doc).toContain("raw corpus");
    expect(doc).not.toContain("two product flows");
  });

  it("foundation migration registers models, session result columns, and drops empty leftover tables", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20261025200000_core_data_model_foundation.sql"),
      "utf8",
    );
    expect(sql).toContain("create table if not exists public.embedding_models");
    expect(sql).toContain("learn-flowcfg-v1-d96");
    expect(sql).toContain("add column if not exists field_model jsonb");
    expect(sql).toContain("add column if not exists result jsonb");
    expect(sql).toContain("drop table if exists public.partners cascade");
    expect(sql).toContain("drop table if exists public.user_solana_wallets cascade");
    expect(sql).not.toContain("drop table if exists public.workspace_proof_of_work");
    expect(sql).not.toContain("drop table if exists public.sessions");
  });

  it("adds owner-scoped Solve flows and session/region foreign keys", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20261030200000_solve_flows.sql"),
      "utf8",
    );
    expect(sql).toContain("create table if not exists public.solve_flows");
    expect(sql).toContain("owner_user_id uuid not null references auth.users(id)");
    expect(sql).toContain("add column if not exists solve_flow_id uuid");
    expect(sql).toContain("sessions_solve_flow_id_fkey");
    expect(sql).toContain("knowledge_regions_solve_flow_id_fkey");
    expect(sql).toContain("'solve'::text");
    expect(sql).toContain("solve-flowcfg-v1-d96");
  });

  it("drops retired AYCL shop tables and Stripe Connect payout columns", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20261110120000_drop_learning_map_shop_payouts.sql"),
      "utf8",
    );
    expect(sql).toContain("drop table if exists public.aycl_purchases cascade");
    expect(sql).toContain("drop table if exists public.aycl_complimentary_links cascade");
    expect(sql).toContain("drop column if exists is_all_you_can_learn");
    expect(sql).toContain("drop column if exists aycl_category");
    expect(sql).toContain("drop column if exists stripe_connect_account_id");
    expect(sql).toContain("drop column if exists stripe_connect_charges_enabled");
    expect(sql).not.toContain("drop table if exists public.workspaces");
    expect(sql).not.toContain("drop table if exists public.blocks");
    expect(sql).not.toContain("drop table if exists public.sessions");
    expect(sql).not.toContain("drop table if exists public.credit_ledger");
  });

  it("stripe webhook ignores retired AYCL checkouts without writing shop tables", () => {
    const webhook = readFileSync(join(ROOT, "app/api/stripe/webhook/route.ts"), "utf8");
    expect(webhook).toContain('priceType === "all_you_can_learn"');
    expect(webhook).toContain("Ignoring retired All-You-Can-Learn checkout");
    expect(webhook).not.toContain("fulfillAyclPurchase");
  });
});
