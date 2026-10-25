import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildVerificationFlowChatSystemPrompt,
  buildVerificationFlowChatUserMessage,
} from "@/lib/verification-flow-chat";
import { emptyTapWorkCanvasScene } from "@/lib/tap-work-canvas";

const ROOT = join(__dirname, "../..");

describe("verification flow canvas chat", () => {
  it("grounds the public chat prompt in the flow topic and the live board", () => {
    const system = buildVerificationFlowChatSystemPrompt("Limits");
    expect(system).toContain("Limits");
    expect(system).toMatch(/Work canvas/i);
    expect(system).toMatch(/JSON/);

    const user = buildVerificationFlowChatUserMessage({
      thought: "Define the selected mark.",
      messages: [{ role: "assistant", content: "What is a limit?" }],
      workCanvasScene: emptyTapWorkCanvasScene(),
      workspaceTitle: "Limits",
    });
    expect(user).toContain("Define the selected mark.");
    expect(user).toContain("What is a limit?");
    expect(user).toContain("SESSION");
    expect(user).toContain("Limits");
  });

  it("ships a public chat route that calls xAI instead of echoing the command", () => {
    const routePath = join(ROOT, "app/api/verification-flow/public/[token]/chat/route.ts");
    expect(existsSync(routePath)).toBe(true);
    const route = readFileSync(routePath, "utf8");
    expect(route).toContain("callXai");
    expect(route).toContain("ileSessionChatCanvasReply");
    expect(route).toContain("getVerificationFlowByToken");
    const flow = readFileSync(join(ROOT, "components/tap-score/use-tap-score-flow.ts"), "utf8");
    expect(flow).not.toContain(
      "return { text: input.prompt, elements: null, origin: null, raw: input.prompt }",
    );
  });
});
