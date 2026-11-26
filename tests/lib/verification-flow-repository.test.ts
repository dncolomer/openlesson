import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addPublicFlowResult,
  getVerificationFlowByToken,
  resetVerificationFlowRepository,
  runVerificationCommand,
} from "@/lib/verification-flow-repository";

const root = join(__dirname, "../..");

describe("verification flow memory shared by public routes", () => {
  it("stores a runner result on the flow created in the same process", async () => {
    resetVerificationFlowRepository();
    const created = await runVerificationCommand({
      type: "create",
      workspaceId: "workspace-1",
      topic: "Limits",
      questions: ["What is a limit?"],
      publicToken: "shared-verification-token",
    });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.flow) return;

    const found = await getVerificationFlowByToken("shared-verification-token");
    expect(found?.id).toBe(created.flow.id);

    const claimed = await runVerificationCommand({
      type: "claim",
      flowId: created.flow.id,
      identity: "ada",
    });
    expect(claimed.ok).toBe(true);

    const stored = await addPublicFlowResult({
      token: "shared-verification-token",
      identity: "ada",
      source: "runner",
      prompt: "What is a limit?",
      questionId: created.flow.questions[0]?.id ?? null,
    });
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.result?.identity).toBe("ada");
    expect(stored.result?.prompt).toBe("What is a limit?");
  });

  it("keeps that record on globalThis and does not resume the live clock when storing proof fails", () => {
    const repository = readFileSync(join(root, "lib/verification-flow-repository.ts"), "utf8");
    expect(repository).toContain("globalThis");
    expect(repository).toContain("__openlessonVerificationFlowRepository");
    expect(repository).not.toMatch(/^let memory = emptyVerificationState\(\);/m);
    expect(repository).toContain('.order("created_at", { ascending: false })');
    expect(repository).toContain(".limit(1)");
    expect(repository).not.toContain(
      '.eq("identity", value.result.identity)\n      .maybeSingle()',
    );

    const identityForm = readFileSync(
      join(root, "components/product-flow/product-flow-identity-form.tsx"),
      "utf8",
    );
    expect(identityForm).toContain("You can run it again with the same identity.");
    expect(identityForm).not.toContain("A duplicate does not start.");
    const runner = readFileSync(join(root, "components/VerificationFlowRunner.tsx"), "utf8");
    expect(runner).not.toContain("That identity is already used");

    const flow = readFileSync(join(root, "components/tap-score/use-tap-score-flow.ts"), "utf8");
    const localEnd = flow.slice(
      flow.indexOf("const prompt = s.messages"),
      flow.indexOf("const durationSeconds"),
    );
    expect(localEnd).toContain('phase: "error"');
    expect(localEnd).not.toContain('phase: "live"');
    expect(localEnd).toContain('phase: "results"');
    expect(localEnd).not.toContain("practice_done");
  });
});
