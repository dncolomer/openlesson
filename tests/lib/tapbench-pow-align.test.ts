/**
 * TAPBench ↔ human TAP PoW alignment + guest attribution.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  alignStashUnitToTapThoughtTrace,
  extractThoughtTextFromStashUnit,
  TAPBENCH_ALIGNED_TOOL_NAME,
  tapbenchActionForDecision,
} from "@/lib/pow-api/tapbench-pow-align";
import {
  buildStashDecisionMetadata,
  ingestStashUnit,
  resetAllStashBuffersForTests,
  unitToPowUploadInput,
  type StashBufferedUnit,
  type StashTapbenchContext,
} from "@/lib/pow-api/stash-api";
import { extractTextFragmentsFromRow } from "@/lib/knowledge-config/experimental-encoders";
import { mintTapbenchLink, resolveTapbenchSession } from "@/lib/pow-api/tapbench";

const guestId = "11111111-1111-4111-8111-111111111111";

function makeUnit(overrides: Partial<StashBufferedUnit> & { dataObj?: unknown } = {}): StashBufferedUnit {
  const { dataObj, ...rest } = overrides;
  const payload =
    dataObj !== undefined
      ? dataObj
      : {
          text: "Lead composite indexes with tenant_id for multi-tenant Postgres.",
          reasoning: ["N+1 is a loop of child queries", "Cache keys must include tenant_id"],
        };
  return {
    id: "stash_thought_1",
    type: "tool",
    type_raw: "tool",
    mime_type: "application/json",
    data: Buffer.from(JSON.stringify(payload)).toString("base64"),
    block_id: "block-1",
    session_id: null,
    timestamp_ms: 1_700_000_000_000,
    tool_name: "reason",
    tool_action: "think",
    metadata: { agent_step: 1 },
    band_powers: null,
    device_name: null,
    sample_count: null,
    pow_model_version: "pow-model-v1",
    buffered_at: 1_700_000_000_000,
    ...rest,
  };
}

const tapbench: StashTapbenchContext = {
  linkId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  exercise: "Exercise: Work through query performance out loud.",
  expires_at: new Date(Date.now() + 60_000).toISOString(),
  remaining_ms: 60_000,
  duration_seconds: 900,
  session_token: "tb_tok",
  block_id: "block-1",
  workspace_id: "ws-1",
  guest_user_id: guestId,
};

describe("extractThoughtTextFromStashUnit", () => {
  it("pulls text / reasoning from agent JSON the way content encoders need", () => {
    const unit = makeUnit();
    const text = extractThoughtTextFromStashUnit(unit);
    expect(text.toLowerCase()).toMatch(/tenant_id|index/);
  });

  it("joins reasoning arrays when text is absent", () => {
    const unit = makeUnit({
      dataObj: { reasoning: ["First thought about joins.", "Second thought about caching."] },
    });
    const text = extractThoughtTextFromStashUnit(unit);
    expect(text).toContain("joins");
    expect(text).toContain("caching");
  });
});

describe("alignStashUnitToTapThoughtTrace", () => {
  it("uses stash_submit_api tool_name with TAP-aligned action and metadata.text", () => {
    const unit = makeUnit();
    const aligned = alignStashUnitToTapThoughtTrace(unit, "stash", tapbench);

    expect(TAPBENCH_ALIGNED_TOOL_NAME).toBe("stash_submit_api");
    expect(aligned.tool_name).toBe("stash_submit_api");
    expect(aligned.tool_action).toBe("system1:pause_finalize");
    expect(tapbenchActionForDecision("stash")).toBe("pause_finalize");
    expect(tapbenchActionForDecision("submit")).toBe("send");

    expect(aligned.metadata.text).toBeTruthy();
    expect(String(aligned.metadata.text).length).toBeGreaterThan(10);
    expect(aligned.metadata.trace_type).toBe("system1");
    expect(aligned.metadata.action).toBe("pause_finalize");
    expect(aligned.metadata.tap_session_id).toBe(tapbench.linkId);
    expect(aligned.metadata.selective_thought).toBe(true);
    expect(aligned.metadata.thought_trace).toBe(true);
    expect(aligned.metadata.tapbench).toBe(true);
    expect(aligned.metadata.guest_user_id).toBe(guestId);

    const file = JSON.parse(Buffer.from(aligned.data, "base64").toString("utf8"));
    expect(file.type).toBe("uncertain_systems_tap_thought_trace");
    expect(file.text).toBe(aligned.metadata.text);
    expect(file.trace_type).toBe("system1");

    // Knowledge content encoder path sees the same text fragments as human TAP
    const frags = extractTextFragmentsFromRow({
      metadata: aligned.metadata,
      tool_name: aligned.tool_name,
      tool_action: aligned.tool_action,
      proof_of_work_type: "tool",
    });
    expect(frags.join(" ")).toContain(String(aligned.metadata.text).slice(0, 20));
  });

  it("submit maps to system2:send like human TAP promote", () => {
    const aligned = alignStashUnitToTapThoughtTrace(makeUnit(), "submit", tapbench);
    expect(aligned.tool_action).toBe("system2:send");
    expect(aligned.metadata.trace_type).toBe("system2");
    expect(aligned.metadata.submit).toBe(true);
    expect(aligned.metadata.stash).toBe(false);
  });
});

describe("unitToPowUploadInput TAPBench path uses alignment", () => {
  beforeEach(() => {
    resetAllStashBuffersForTests();
  });

  it("flush input is TAP-trace shaped with text for embedding parity", () => {
    const body = {
      type: "tool",
      mime_type: "application/json",
      data: Buffer.from(
        JSON.stringify({ text: "Avoid N+1 by batching child lookups with ANY($1)." }),
      ).toString("base64"),
      tool_name: "agent",
      tool_action: "note",
    };
    const ingested = ingestStashUnit("ws-1", guestId, body);
    expect(ingested.ok).toBe(true);
    if (!ingested.ok) return;

    const input = unitToPowUploadInput(ingested.unit, "submit", tapbench);
    expect(input.tool_name).toBe("stash_submit_api");
    expect(input.tool_action).toBe("system2:send");
    expect(input.metadata?.text).toMatch(/N\+1|ANY/);
    expect(input.metadata?.tapbench).toBe(true);
    expect(input.metadata?.guest_user_id).toBe(guestId);
    expect(input.file_name).toMatch(/^tap-trace-system2-send-/);

    // Non-tapbench stash keeps raw agent shape
    const plain = unitToPowUploadInput(ingested.unit, "stash", null);
    expect(plain.tool_name).toBe("agent");
    expect(plain.metadata?.tapbench).toBeUndefined();
  });
});

describe("TAPBench mint records guest subject", () => {
  it("mintTapbenchLink stores guest_user_id for session attribution", () => {
    const minted = mintTapbenchLink({
      workspaceId: "ws-g",
      guestUserId: guestId,
      sessionToken: "tok_guest",
      id: "link-g",
      durationSeconds: 120,
    });
    expect(minted.link.guest_user_id).toBe(guestId);
    const resolved = resolveTapbenchSession(minted.link, "tok_guest");
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.guest_user_id).toBe(guestId);
  });
});

describe("buildStashDecisionMetadata includes TAP session + guest fields", () => {
  it("sets tap_session_id and guest for region / encoder queries", () => {
    const meta = buildStashDecisionMetadata("stash", { custom: 1 }, tapbench);
    expect(meta.tap_session_id).toBe(tapbench.linkId);
    expect(meta.guest_user_id).toBe(guestId);
    expect(meta.selective_thought).toBe(true);
    expect(meta.thought_trace).toBe(true);
    expect(meta.trace_type).toBe("system1");
  });
});
