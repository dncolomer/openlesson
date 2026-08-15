import { describe, expect, it, beforeEach, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  STASH_ALLOWED_POW_TYPES,
  STASH_API_PRODUCT,
  bufferSubjectId,
  buildStashDecisionMetadata,
  clearStashBuffer,
  flushStashBuffer,
  getStashBufferSize,
  ingestStashUnit,
  parseStashIngestInput,
  peekStashBuffer,
  resetAllStashBuffersForTests,
  stashBufferedProofOfWork,
  submitBufferedProofOfWork,
  systemFlagForDecision,
  unitToPowUploadInput,
  type StashPowFlushUploader,
} from "@/lib/pow-api/stash-api";
import {
  isAllowedProofOfWorkMime,
  normalizeProofOfWorkType,
  WORKSPACE_PROOF_OF_WORK_TYPES,
} from "@/lib/pow-api/workspace-proof-of-work";
import { PRODUCTS, AGENT_COLUMN_PRODUCTS } from "@/lib/seo/products";
import { LANDING_PRODUCT_ROWS } from "@/components/ProductTable";
import { PLATFORM_PITCH_DECK } from "@/lib/sales/platform-pitch-deck";
import { STASH_API_BASE } from "@/lib/api/agent-api-paths";

const ROOT = join(__dirname, "../..");

const sampleToolPayload = Buffer.from(
  JSON.stringify({ action: "tool_call", tool: "search", args: { q: "algebra" } }),
).toString("base64");

function toolBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "tool",
    mime_type: "application/json",
    data: sampleToolPayload,
    tool_name: "search",
    tool_action: "query",
    metadata: { step: 1 },
    ...overrides,
  };
}

const mockAuth = {
  user_id: "user-abc",
  guest_user_id: null as string | null,
  organization_id: "org-1",
  is_org_admin: false,
  key_id: "key-1",
  scopes: ["workspaces:write" as const],
};

const mockWorkspace = {
  id: "ws-1",
  user_id: "user-abc",
  organization_id: "org-1",
};

const mockSupabase = {} as never;

describe("Stash API buffer + stash/submit flush", () => {
  beforeEach(() => {
    resetAllStashBuffersForTests();
  });

  it("accepts the same PoW type surface as Proof-of-Work API", () => {
    for (const t of WORKSPACE_PROOF_OF_WORK_TYPES) {
      expect(normalizeProofOfWorkType(t)).toBe(t);
    }
    expect(normalizeProofOfWorkType("screenshot")).toBe("screen");
    expect(STASH_ALLOWED_POW_TYPES).toEqual(
      expect.arrayContaining([...WORKSPACE_PROOF_OF_WORK_TYPES, "screenshot"]),
    );

    const tool = parseStashIngestInput(toolBody());
    expect(tool.ok).toBe(true);
    if (tool.ok) expect(tool.unit.type).toBe("tool");

    const screen = parseStashIngestInput({
      type: "screenshot",
      mime_type: "image/png",
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"),
    });
    expect(screen.ok).toBe(true);
    if (screen.ok) expect(screen.unit.type).toBe("screen");

    const video = parseStashIngestInput({
      type: "video",
      mime_type: "video/mp4",
      data: Buffer.from("fake-mp4").toString("base64"),
    });
    expect(video.ok).toBe(true);
    if (video.ok) expect(video.unit.type).toBe("video");

    const eeg = parseStashIngestInput({
      type: "eeg",
      mime_type: "application/json",
      data: Buffer.from(JSON.stringify({ samples: [1, 2, 3] })).toString("base64"),
    });
    expect(eeg.ok).toBe(true);
    if (eeg.ok) expect(eeg.unit.type).toBe("eeg");

    expect(isAllowedProofOfWorkMime("tool", "application/json")).toBe(true);
    expect(parseStashIngestInput({ type: "tool", mime_type: "image/png", data: "YQ==" }).ok).toBe(
      false,
    );
  });

  it("buffers ingest units without durable PoW upload until decision", () => {
    const subject = bufferSubjectId(mockAuth);
    const a = ingestStashUnit("ws-1", subject, toolBody({ tool_name: "a" }));
    const b = ingestStashUnit("ws-1", subject, toolBody({ tool_name: "b" }));
    expect(a.ok && b.ok).toBe(true);
    expect(getStashBufferSize("ws-1", subject)).toBe(2);
    expect(peekStashBuffer("ws-1", subject).map((u) => u.tool_name)).toEqual(["a", "b"]);
  });

  it("stash flushes via real flush path with System 1 metadata then empties buffer", async () => {
    const subject = bufferSubjectId(mockAuth);
    expect(ingestStashUnit("ws-1", subject, toolBody()).ok).toBe(true);
    expect(ingestStashUnit("ws-1", subject, toolBody({ type: "screenshot", mime_type: "image/png", data: Buffer.from([1, 2, 3]).toString("base64") })).ok).toBe(true);

    const calls: Array<{ decision: string; system: number; type: string; meta: Record<string, unknown> }> = [];
    const uploader: StashPowFlushUploader = async ({ unit, decision, workspaceId, auth }) => {
      const input = unitToPowUploadInput(unit, decision);
      input.workspaceId = workspaceId;
      expect(workspaceId).toBe("ws-1");
      expect(auth.user_id).toBe("user-abc");
      const meta = input.metadata as Record<string, unknown>;
      calls.push({
        decision,
        system: meta.system as number,
        type: input.type,
        meta,
      });
      return {
        id: `pow-${calls.length}`,
        workspace_id: workspaceId,
        proof_of_work_type: unit.type,
        metadata: meta,
        user_ref: auth.user_id,
      };
    };

    const result = await stashBufferedProofOfWork({
      workspaceId: "ws-1",
      subjectId: subject,
      auth: mockAuth,
      workspace: mockWorkspace,
      supabase: mockSupabase,
      uploader,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision).toBe("stash");
    expect(result.system).toBe(1);
    expect(systemFlagForDecision("stash")).toBe(1);
    expect(result.flushed).toBe(2);
    expect(result.empty).toBe(false);
    expect(result.buffer_remaining).toBe(0);
    expect(getStashBufferSize("ws-1", subject)).toBe(0);
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.decision === "stash" && c.system === 1)).toBe(true);
    expect(calls.every((c) => c.meta.stash === true && c.meta.submit === false)).toBe(true);
    expect(calls.every((c) => c.meta.trace_type === "system1")).toBe(true);
    expect(calls.every((c) => c.meta.source === "stash_api")).toBe(true);
    expect(calls.map((c) => c.type).sort()).toEqual(["screen", "tool"]);
    // workspace + user refs present on flush results
    expect(result.proof_of_work).toHaveLength(2);
    expect((result.proof_of_work[0] as { user_ref: string }).user_ref).toBe("user-abc");
    expect((result.proof_of_work[0] as { workspace_id: string }).workspace_id).toBe("ws-1");
  });

  it("submit flushes with System 2 flag then empties buffer", async () => {
    const subject = bufferSubjectId(mockAuth);
    expect(ingestStashUnit("ws-1", subject, toolBody()).ok).toBe(true);

    const metas: Record<string, unknown>[] = [];
    const uploader: StashPowFlushUploader = async ({ unit, decision, workspaceId }) => {
      const input = unitToPowUploadInput(unit, decision);
      input.workspaceId = workspaceId;
      metas.push(input.metadata as Record<string, unknown>);
      return { id: "pow-sub", metadata: input.metadata };
    };

    const result = await submitBufferedProofOfWork({
      workspaceId: "ws-1",
      subjectId: subject,
      auth: mockAuth,
      workspace: mockWorkspace,
      supabase: mockSupabase,
      uploader,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision).toBe("submit");
    expect(result.system).toBe(2);
    expect(result.flushed).toBe(1);
    expect(getStashBufferSize("ws-1", subject)).toBe(0);
    expect(metas[0]?.system).toBe(2);
    expect(metas[0]?.submit).toBe(true);
    expect(metas[0]?.stash).toBe(false);
    expect(metas[0]?.trace_type).toBe("system2");
  });

  it("empty-buffer stash/submit no-ops cleanly without half-flushed state", async () => {
    const subject = bufferSubjectId(mockAuth);
    const uploader = vi.fn(async () => ({ id: "should-not-run" }));

    const stash = await stashBufferedProofOfWork({
      workspaceId: "ws-1",
      subjectId: subject,
      auth: mockAuth,
      workspace: mockWorkspace,
      supabase: mockSupabase,
      uploader,
    });
    const submit = await submitBufferedProofOfWork({
      workspaceId: "ws-1",
      subjectId: subject,
      auth: mockAuth,
      workspace: mockWorkspace,
      supabase: mockSupabase,
      uploader,
    });

    expect(stash.ok && stash.empty && stash.flushed === 0).toBe(true);
    expect(submit.ok && submit.empty && submit.flushed === 0).toBe(true);
    expect(uploader).not.toHaveBeenCalled();
    expect(getStashBufferSize("ws-1", subject)).toBe(0);
  });

  it("keeps buffer intact when PoW uploader fails mid-flush", async () => {
    const subject = bufferSubjectId(mockAuth);
    expect(ingestStashUnit("ws-1", subject, toolBody({ tool_name: "one" })).ok).toBe(true);
    expect(ingestStashUnit("ws-1", subject, toolBody({ tool_name: "two" })).ok).toBe(true);

    let n = 0;
    const result = await flushStashBuffer({
      workspaceId: "ws-1",
      subjectId: subject,
      decision: "submit",
      auth: mockAuth,
      workspace: mockWorkspace,
      supabase: mockSupabase,
      uploader: async () => {
        n += 1;
        if (n === 2) throw new Error("xAI upload failed");
        return { id: "ok" };
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flushed).toBe(1);
    expect(result.buffer_remaining).toBe(2);
    expect(getStashBufferSize("ws-1", subject)).toBe(2);
  });

  it("buildStashDecisionMetadata encodes System 1/2 like TAP intent (no alaTAP)", () => {
    const s1 = buildStashDecisionMetadata("stash", { custom: true });
    expect(s1).toMatchObject({
      custom: true,
      system: 1,
      stash: true,
      submit: false,
      trace_type: "system1",
      source: "stash_api",
      agentic_product: "stash_api",
    });
    expect(s1.alatap).toBeUndefined();
    const s2 = buildStashDecisionMetadata("submit");
    expect(s2).toMatchObject({ system: 2, submit: true, stash: false, trace_type: "system2" });
  });

  it("isolates buffers per workspace and subject", () => {
    expect(ingestStashUnit("ws-a", "user-1", toolBody()).ok).toBe(true);
    expect(ingestStashUnit("ws-b", "user-1", toolBody()).ok).toBe(true);
    expect(ingestStashUnit("ws-a", "user-2", toolBody()).ok).toBe(true);
    expect(getStashBufferSize("ws-a", "user-1")).toBe(1);
    expect(getStashBufferSize("ws-b", "user-1")).toBe(1);
    clearStashBuffer("ws-a", "user-1");
    expect(getStashBufferSize("ws-a", "user-1")).toBe(0);
    expect(getStashBufferSize("ws-b", "user-1")).toBe(1);
  });
});

describe("Stash API entry paths (handlers + routes)", () => {
  beforeEach(() => {
    resetAllStashBuffersForTests();
  });

  it("route modules exist for ingest, stash, and submit", () => {
    const routes = [
      "app/api/v3/stash/workspaces/[id]/proof-of-work/route.ts",
      "app/api/v3/stash/workspaces/[id]/stash/route.ts",
      "app/api/v3/stash/workspaces/[id]/submit/route.ts",
    ];
    for (const r of routes) {
      expect(existsSync(join(ROOT, r)), r).toBe(true);
    }
    expect(STASH_API_BASE).toBe("/api/v3/stash");
  });

  it("imports and invokes decision handlers from a fresh consumer path", async () => {
    // Dynamic import simulates a fresh consumer loading the public API surface
    const stashApi = await import("@/lib/pow-api/stash-api");
    stashApi.resetAllStashBuffersForTests();

    const subject = stashApi.bufferSubjectId(mockAuth);
    const ingested = stashApi.ingestStashUnit("ws-entry", subject, toolBody());
    expect(ingested.ok).toBe(true);

    const uploads: unknown[] = [];
    const result = await stashApi.stashBufferedProofOfWork({
      workspaceId: "ws-entry",
      subjectId: subject,
      auth: mockAuth,
      workspace: { id: "ws-entry", user_id: "user-abc", organization_id: null },
      supabase: mockSupabase,
      uploader: async ({ unit, decision, workspaceId, auth }) => {
        const input = stashApi.unitToPowUploadInput(unit, decision);
        input.workspaceId = workspaceId;
        uploads.push({
          workspaceId,
          user_id: auth.user_id,
          system: input.metadata?.system,
          decision: input.metadata?.decision,
        });
        return { id: "entry-pow", ...input.metadata };
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.system).toBe(1);
    expect(result.flushed).toBe(1);
    expect(uploads).toEqual([
      { workspaceId: "ws-entry", user_id: "user-abc", system: 1, decision: "stash" },
    ]);
    expect(stashApi.getStashBufferSize("ws-entry", subject)).toBe(0);

    // submit path with refill
    expect(stashApi.ingestStashUnit("ws-entry", subject, toolBody()).ok).toBe(true);
    const submit = await stashApi.submitBufferedProofOfWork({
      workspaceId: "ws-entry",
      subjectId: subject,
      auth: mockAuth,
      workspace: { id: "ws-entry", user_id: "user-abc", organization_id: null },
      supabase: mockSupabase,
      uploader: async ({ unit, decision }) => {
        const input = stashApi.unitToPowUploadInput(unit, decision);
        return { system: input.metadata?.system };
      },
    });
    expect(submit.ok && submit.system === 2 && submit.flushed === 1).toBe(true);
  });

  it("HTTP route source wires auth and decision helpers", () => {
    const stashRoute = readFileSync(
      join(ROOT, "app/api/v3/stash/workspaces/[id]/stash/route.ts"),
      "utf8",
    );
    const submitRoute = readFileSync(
      join(ROOT, "app/api/v3/stash/workspaces/[id]/submit/route.ts"),
      "utf8",
    );
    const ingestRoute = readFileSync(
      join(ROOT, "app/api/v3/stash/workspaces/[id]/proof-of-work/route.ts"),
      "utf8",
    );
    expect(stashRoute).toContain("stashBufferedProofOfWork");
    expect(stashRoute).toContain('decision: "stash"');
    expect(stashRoute).toContain("System 1");
    expect(submitRoute).toContain("submitBufferedProofOfWork");
    expect(submitRoute).toContain('decision: "submit"');
    expect(submitRoute).toContain("System 2");
    expect(ingestRoute).toContain("ingestStashUnit");
    expect(ingestRoute).toContain("authenticateStashRequest");
  });
});

describe("Stash API product surfaces", () => {
  it("PRODUCTS and landing rows list Stash API as agent product (alaTAP)", () => {
    const product = PRODUCTS.find((p) => p.id === "stash-api");
    expect(product).toBeTruthy();
    expect(product?.title).toBe("Stash API");
    expect(product?.forAgent?.summary.toLowerCase()).toMatch(/alatap|evaluate agents|tap/);
    // No public product detail route — home platform listing only
    expect(product?.forAgent?.href).toBeUndefined();
    expect(product?.forAgent?.ctaLabel).toBeUndefined();
    expect(AGENT_COLUMN_PRODUCTS.some((p) => p.id === "stash-api")).toBe(true);

    const landing = LANDING_PRODUCT_ROWS.find((r) => r.name === "Stash API");
    expect(landing).toBeTruthy();
    expect(landing?.pitch.toLowerCase()).toMatch(
      /evaluate agentic knowledge.*systems? 1 and 2 traces/,
    );
    expect(landing?.href).toBeUndefined();
    expect(landing?.ctaLabel).toBeUndefined();
    expect(STASH_API_PRODUCT.name).toBe("Stash API");
  });

  it("Stash API SEO module remains; public product landing route is gone", () => {
    expect(existsSync(join(ROOT, "app/products/stash-api/page.tsx"))).toBe(false);
    const page = readFileSync(join(ROOT, "lib/seo/product-page.ts"), "utf8");
    expect(page).toContain("STASH_API_PAGE");
    expect(page).toMatch(/evaluate agents the same way we evaluate humans with TAP/i);
    expect(page).toContain("alaTAP");
  });

  it("platform pitch products slide has four cards including Stash API; interface slide removed", () => {
    const productsSlide = PLATFORM_PITCH_DECK.slides.find(
      (s) => s.kicker?.toLowerCase() === "our products" && (s.cards?.length ?? 0) >= 3,
    );
    expect(productsSlide).toBeTruthy();
    expect(productsSlide?.cardLayout).toBe("product-stack");
    // Top→bottom: TAP|ILE shared layer → Stash → PoW foundation
    expect(productsSlide?.cards?.map((c) => c.label.toLowerCase())).toEqual([
      "tap",
      "ile",
      "stash api",
      "pow api",
    ]);
    expect(productsSlide?.cards).toHaveLength(4);
    const stashCard = productsSlide?.cards?.find((c) => /stash api/i.test(c.label));
    expect(stashCard?.body?.toLowerCase()).toMatch(
      /buffer agent proof of work.*stash \(system 1\).*submit \(system 2\)/,
    );
    expect(stashCard?.ideas ?? []).toHaveLength(0);

    expect(
      PLATFORM_PITCH_DECK.slides.some((s) =>
        /one interface:\s*proof of work with stash/i.test(s.title ?? ""),
      ),
    ).toBe(false);

    // Landing may or may not name Stash API; product deck is the source of truth above.
    expect(STASH_API_PRODUCT.name).toBe("Stash API");
  });
});
