import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { DEFAULT_PROMPTS, ILE_CONTEXT, type PromptKey } from "@/lib/prompts";
import { buildGhcScoreInstructions } from "@/lib/ghc-score";
import { buildProofOfWorkSchemaInstructions } from "@/lib/agent-v2/proof-of-work-schema";

const ACTIVE_KEYS: PromptKey[] = [
  "gap_detection",
  "opening_probe",
  "probe_generation",
  "report_generation",
  "follow_up_sessions",
  "generate_objectives",
  "session_plan_create",
  "session_plan_update",
  "stuck_policy_recommendation",
];

const LEGACY_KEYS: PromptKey[] = [
  "session_end_check",
  "expand_probe",
  "ask_question",
  "feedback_and_question",
  "fresh_question",
  "check_probe_archive",
];

describe("prompt inventory", () => {
  it("covers every DEFAULT_PROMPTS key as active or legacy", () => {
    const allKeys = Object.keys(DEFAULT_PROMPTS) as PromptKey[];
    const classified = new Set([...ACTIVE_KEYS, ...LEGACY_KEYS]);
    expect(classified.size).toBe(allKeys.length);
    for (const key of allKeys) {
      expect(classified.has(key)).toBe(true);
    }
  });

  it("active keys are referenced by getPrompt in lib/xai.ts", () => {
    const xaiSrc = fs.readFileSync(
      path.join(process.cwd(), "lib/xai.ts"),
      "utf8",
    );
    for (const key of ACTIVE_KEYS) {
      expect(xaiSrc).toContain(`getPrompt("${key}"`);
    }
    for (const key of LEGACY_KEYS) {
      expect(xaiSrc).not.toContain(`getPrompt("${key}"`);
    }
  });

  it("every registry prompt has non-empty default text", () => {
    for (const key of Object.keys(DEFAULT_PROMPTS) as PromptKey[]) {
      expect(DEFAULT_PROMPTS[key].trim().length).toBeGreaterThan(20);
    }
  });

  it("ILE_CONTEXT and inline session-chat prompt are non-empty exports", () => {
    expect(ILE_CONTEXT.trim().length).toBeGreaterThan(100);
    const sessionChatSrc = fs.readFileSync(
      path.join(process.cwd(), "app/api/session-chat/route.ts"),
      "utf8",
    );
    const match = sessionChatSrc.match(
      /const BASE_SYSTEM_PROMPT = `([\s\S]*?)`;/,
    );
    expect(match?.[1]?.trim().length).toBeGreaterThan(100);
  });

  it("suggest-plan-topic route has inline userMessage prompt", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/api/suggest-plan-topic/route.ts"),
      "utf8",
    );
    expect(src).toContain("suggest ONE specific learning plan topic");
    expect(src).toContain("Return ONLY the suggested topic text");
  });

  it("prompt-call-sites.json exists and lists production inventory paths", () => {
    const sitesPath = path.join(
      process.cwd(),
      "tests/fixtures/prompt-inventory/prompt-call-sites.json",
    );
    expect(fs.existsSync(sitesPath)).toBe(true);
    const sites = JSON.parse(fs.readFileSync(sitesPath, "utf8")) as {
      allInventoryPaths: string[];
    };
    expect(sites.allInventoryPaths.length).toBeGreaterThanOrEqual(45);
    expect(sites.allInventoryPaths).toContain("lib/prompts.ts");
    expect(sites.allInventoryPaths).toContain(
      "lib/agent-v2/create-verification-workspace.ts",
    );
  });

  it("generated prompt report covers scanner paths and critical symbols", () => {
    const reportPath = path.join(
      process.cwd(),
      "tests/fixtures/prompt-inventory/prompt-analysis.md",
    );
    expect(fs.existsSync(reportPath)).toBe(true);
    const report = fs.readFileSync(reportPath, "utf8");
    expect(report.length).toBeGreaterThan(50_000);

    const sites = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "tests/fixtures/prompt-inventory/prompt-call-sites.json",
        ),
        "utf8",
      ),
    ) as { allInventoryPaths: string[] };

    const skipPaths = new Set(["lib/xai-client.ts"]);
    for (const rel of sites.allInventoryPaths) {
      if (skipPaths.has(rel)) continue;
      expect(report).toContain(rel);
    }

    for (const key of ACTIVE_KEYS) {
      expect(report).toContain(`\`${key}\``);
    }
    expect(report).toContain("createVerificationWorkspaceFromPrompt");
    expect(report).toContain("generateTapOpeningQuestion-system-extension");
    expect(report).toContain("generateTapOpeningQuestion-userMessage");
    expect(report).toContain("Override Mechanism");
    expect(report).toContain("## Summary Table");
  });

  it("builder instructions return full non-truncated templates", () => {
    const ghc = buildGhcScoreInstructions(
      {
        plan: {
          id: "p1",
          title: "Test Plan",
          root_topic: "Topic",
          description: null,
          notes: null,
        },
        nodes: [],
        sessions: [],
        focusSession: null,
      },
      "curious",
      10,
    );
    expect(ghc).toContain("Think Aloud Protocol (TAP)");
    expect(ghc).toContain("Teach me what you learned here");

    const schema = buildProofOfWorkSchemaInstructions(
      { definition: "Verify workflow execution", block_id: null },
      null,
    );
    expect(schema).toContain("OpenLesson proof-of-work architect");
    expect(schema).not.toMatch(/\.\.\.$/);
    expect(schema.length).toBeGreaterThan(500);
  });
});