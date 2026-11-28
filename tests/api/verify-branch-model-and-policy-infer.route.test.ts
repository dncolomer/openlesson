import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetFlowByToken, mockGenerateOpening, mockInferPolicy } = vi.hoisted(() => ({
  mockGetFlowByToken: vi.fn(),
  mockGenerateOpening: vi.fn(),
  mockInferPolicy: vi.fn(),
}));

vi.mock("@/lib/verification-flow-repository", () => ({
  getVerificationFlowByToken: mockGetFlowByToken,
  getVerificationFlowById: vi.fn(async () => null),
}));

vi.mock("@/lib/session-branch-model-generate", () => ({
  generateSessionBranchOpening: mockGenerateOpening,
  continueSessionBranchModel: vi.fn(),
  sessionBranchContinuationFromSeed: vi.fn(() => null),
}));

vi.mock("@/lib/session-policy-infer-xai", () => ({
  inferSessionPolicyReply: mockInferPolicy,
  inferSessionGapReply: vi.fn(),
  suggestSessionPolicyReply: vi.fn(),
}));

import { POST as branchModelPost } from "@/app/api/verify/session/branch-model/route";
import { POST as policyInferPost } from "@/app/api/verify/session/policy-infer/route";

describe("/api/verify/session/branch-model and /api/verify/session/policy-infer", () => {
  beforeEach(() => {
    mockGetFlowByToken.mockReset();
    mockGenerateOpening.mockReset();
    mockInferPolicy.mockReset();
  });

  it("returns 404 from branch-model when verification token is unknown", async () => {
    mockGetFlowByToken.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/verify/session/branch-model", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        verificationToken: "unknown-tok",
        chapterTitle: "Limits",
        chapterBrief: "Prove limit uniqueness",
      }),
    });
    const res = await branchModelPost(req);
    expect(res.status).toBe(404);
  });

  it("prepares a verification branch model for a valid public verification token", async () => {
    mockGetFlowByToken.mockResolvedValue({
      id: "vf-1",
      topic: "Prove limit uniqueness",
      artifacts: [],
      exactProblemOnCanvas: true,
      openingCanvasScene: null,
      generateProblemOnOpen: false,
      answersModelSeed: null,
    });
    mockGenerateOpening.mockResolvedValue({
      ok: true,
      model: { chapterTitle: "Limits", rootId: "root", focusId: "root", branches: [] },
      continuation: null,
    });

    const req = new NextRequest("http://localhost/api/verify/session/branch-model", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        verificationToken: "vtok-1",
        chapterTitle: "Limits",
        chapterBrief: "Prove limit uniqueness",
        phase: "opening",
      }),
    });
    const res = await branchModelPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.model.rootId).toBe("root");
    expect(body.openingWorkExact).toBe(true);
    expect(body.openingWork).toBe("Prove limit uniqueness");
  });

  it("runs policy inference for a valid verification token", async () => {
    mockGetFlowByToken.mockResolvedValue({ id: "vf-1", topic: "Limits" });
    mockInferPolicy.mockResolvedValue({
      ok: true,
      reply: JSON.stringify({ hiddenStateId: "r1", confidence: 0.9, line: "You checked epsilon." }),
    });

    const req = new NextRequest("http://localhost/api/verify/session/policy-infer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        verificationToken: "vtok-1",
        chapterTitle: "Limits",
        chapterBrief: "Prove limit uniqueness",
        phase: "infer",
        events: [{ action: "draw_text", prompt: "epsilon > 0" }],
        candidates: "r1: epsilon bound",
      }),
    });
    const res = await policyInferPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toContain("r1");
  });
});
