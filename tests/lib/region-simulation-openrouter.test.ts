import { afterEach, describe, expect, it } from "vitest";
import {
  OPENROUTER_ORG_KEY_MISSING,
  OPENROUTER_ROUND_TIMEOUT_MS,
  openRouterChatCompletions,
  openRouterHeaders,
  openRouterUserHash,
  setOpenRouterFetchForTests,
} from "@/lib/ai/openrouter";
import { setOrgOpenRouterApiKeyForTests } from "@/lib/organization/org-backend-runtime";
import { AI_USE_DEFAULT_CHECKED, clampSamplesPerAiUse, publicAiUseCatalog } from "@/lib/region-simulation-ai-use-catalog";
import { catalogRowsMissingTools } from "../../scripts/check-openrouter-catalog";
import { AI_USE_CATALOG } from "@/lib/region-simulation-ai-use-catalog";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyProofOfWorkRunIdFilter } from "@/lib/region-simulation-persist";
import { createAiUseCheckpoint, runAiUseHarnessRound } from "@/lib/region-simulation-harness";
import { seededSimulationTree } from "@/lib/region-simulation";
import {
  drainRegionSimulationJobs,
  enqueueRegionSimulation,
  resetRegionSimulationJobsForTests,
  tickRegionSimulationJob,
} from "@/lib/region-simulation-jobs";
import { parseKnowledgeRegionFigureSpace, placeKnowledgeRegionAiUsePoints } from "@/lib/knowledge-region-figure";

describe("openrouter client", () => {
  afterEach(() => {
    setOpenRouterFetchForTests(null);
    setOrgOpenRouterApiKeyForTests(undefined);
  });

  it("sends referer and title and does not retry timeouts", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-env-must-be-ignored";
    expect(() => openRouterHeaders(null)).toThrow(OPENROUTER_ORG_KEY_MISSING);
    const headers = openRouterHeaders("sk-or-test");
    expect(headers.Authorization).toBe("Bearer sk-or-test");
    expect(headers["X-OpenRouter-Title"]).toBe("OpenLesson");
    expect(headers["HTTP-Referer"]).toBeTruthy();
    expect(openRouterUserHash("owner-1")).toHaveLength(32);
    expect(OPENROUTER_ROUND_TIMEOUT_MS).toBe(45_000);
    const source = readFileSync(join(__dirname, "../../lib/ai/openrouter.ts"), "utf8");
    expect(source).not.toContain("OPENROUTER_API_KEY");
    expect(source).toContain("OPENROUTER_ORG_KEY_MISSING");

    let calls = 0;
    setOpenRouterFetchForTests(async () => {
      calls += 1;
      const err = new Error("aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    });
    await expect(
      openRouterChatCompletions({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
        apiKey: "sk-or-test",
      }),
    ).rejects.toThrow(/timeout/i);
    expect(calls).toBe(1);
  });

  it("retries 429 once then returns tool calls", async () => {
    let calls = 0;
    setOpenRouterFetchForTests(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ error: { message: "rate" } }), { status: 429 });
      }
      return new Response(
        JSON.stringify({
          id: "gen_1",
          usage: { cost: 0.01 },
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: { name: "board_done", arguments: "{}" },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    });
    const result = await openRouterChatCompletions({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }],
      tools: [],
      apiKey: "sk-or-test",
    });
    expect(calls).toBe(2);
    expect(result.toolCalls[0]?.function.name).toBe("board_done");
    expect(result.costUsd).toBe(0.01);
  });
  it("sends usage.include=true, parses fallback token cost, and halts jobs at OPENROUTER_JOB_MAX_USD", async () => {
    let seenBody: Record<string, unknown> | null = null;
    setOpenRouterFetchForTests(async (_url, init) => {
      seenBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          id: "gen_fallback",
          usage: { prompt_tokens: 10_000, completion_tokens: 5_000 },
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                tool_calls: [
                  {
                    id: "call_fb",
                    type: "function",
                    function: { name: "board_done", arguments: "{}" },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    });
    const res = await openRouterChatCompletions({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }],
      apiKey: "sk-or-test",
    });
    expect(seenBody).toMatchObject({ usage: { include: true } });
    expect(res.costUsd).toBeGreaterThan(0);

    const prevMax = process.env.OPENROUTER_JOB_MAX_USD;
    process.env.OPENROUTER_JOB_MAX_USD = "0.05";
    try {
      resetRegionSimulationJobsForTests();
      setOrgOpenRouterApiKeyForTests("sk-or-cap-test");
      setOpenRouterFetchForTests(async () =>
        new Response(
          JSON.stringify({
            id: "gen_expensive",
            usage: { cost: 0.08 },
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  role: "assistant",
                  tool_calls: [
                    {
                      id: "call_exp",
                      type: "function",
                      function: { name: "board_done", arguments: "{}" },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
      const job = await enqueueRegionSimulation({
        ownerUserId: "owner-cap",
        family: "ai_use",
        name: "Cap Region",
        kind: "verification",
        flows: [{ id: "flow-cap", name: "Flow", problems: ["P"] }],
        catalogIds: [AI_USE_CATALOG[0]!.id],
        samplesPerAiUse: 3,
      });
      const ticked = await tickRegionSimulationJob(job.id);
      expect(ticked.job.status).toBe("failed");
      expect(ticked.job.error).toBe("OpenRouter job USD cap");
      expect(ticked.job.cost_usd).toBeGreaterThanOrEqual(0.05);
    } finally {
      if (prevMax === undefined) delete process.env.OPENROUTER_JOB_MAX_USD;
      else process.env.OPENROUTER_JOB_MAX_USD = prevMax;
    }
  });
});

describe("ai-use catalog", () => {
  it("exposes no default-checked rows and no slugs on the public GET", () => {
    expect(AI_USE_DEFAULT_CHECKED).toEqual([]);
    expect(clampSamplesPerAiUse(1)).toBe(3);
    expect(clampSamplesPerAiUse(99)).toBe(12);
    const publicRows = publicAiUseCatalog();
    expect(JSON.stringify(publicRows)).not.toMatch(/openai\/|anthropic\/|google\/|x-ai\//);
    const fixture = JSON.parse(
      readFileSync(join(__dirname, "../fixtures/openrouter-catalog.json"), "utf8"),
    ) as { data: Array<{ id: string; supported_parameters: string[] }> };
    expect(catalogRowsMissingTools(AI_USE_CATALOG, fixture.data)).toEqual([]);
  });
});

describe("inspect run filter", () => {
  it("uses tap_session_id only for sim_* ids", () => {
    const calls: string[] = [];
    const query = {
      or(filter: string) {
        calls.push(`or:${filter}`);
        return query;
      },
      contains(col: string, value: object) {
        calls.push(`contains:${col}:${JSON.stringify(value)}`);
        return query;
      },
    };
    applyProofOfWorkRunIdFilter(query, "sim_exploit-heavy_0_seed");
    expect(calls[0]).toContain("tap_session_id");
    expect(calls.join("")).not.toContain("session_id.eq.sim_");
    applyProofOfWorkRunIdFilter(query, "11111111-1111-1111-1111-111111111111");
    expect(calls.some((row) => row.includes("session_id.eq."))).toBe(true);
  });
});

describe("ai-use harness", () => {
  it("applies one round and checkpoints board_done", async () => {
    const model = seededSimulationTree({ problem: "P", seed: "s", strategyId: "balanced" });
    const catalog = AI_USE_CATALOG[0]!;
    const checkpoint = createAiUseCheckpoint({
      catalog,
      runId: "aiusim_gpt-mini-low_0_s",
      problem: "P",
      seed: "s",
      flowKind: "verify",
      ownerUserId: "owner",
      planCursor: 0,
      sampleIndex: 0,
      model,
    });
    const result = await runAiUseHarnessRound({
      checkpoint,
      catalog,
      seed: "s",
      flowKind: "verify",
      model,
      ownerUserId: "owner",
      complete: async () => ({
        message: {
          role: "assistant",
          tool_calls: [
            {
              id: "c1",
              type: "function",
              function: { name: "board_done", arguments: "{}" },
            },
          ],
        },
        toolCalls: [
          { id: "c1", type: "function", function: { name: "board_done", arguments: "{}" } },
        ],
        finishReason: "tool_calls",
        costUsd: 0.02,
        generationId: "g",
        wallMs: 400,
      }),
    });
    expect(result.done).toBe(true);
    expect(result.checkpoint.clockMs).toBeGreaterThan(checkpoint.clockMs);
  });
});

describe("jobs drain", () => {
  afterEach(() => setOrgOpenRouterApiKeyForTests(undefined));

  it("ticks queued memory jobs from cron drain", async () => {
    resetRegionSimulationJobsForTests();
    const job = await enqueueRegionSimulation({
      ownerUserId: "owner-1",
      family: "exploration",
      name: "Region",
      kind: "verification",
      flows: [{ id: "flow-1", name: "Flow", problems: ["P"] }],
      strategies: [
        {
          id: "exploit-heavy",
          name: "Exploit-heavy",
          description: "",
          instructions: "",
          params: { maxSteps: 3, prefer: "cheap", commitAfter: 0 },
        },
      ],
      samplesPerStrategy: 3,
    });
    expect(job.status).toBe("queued");
    const ids = await drainRegionSimulationJobs(10);
    expect(ids).toContain(job.id);
    const after = await tickRegionSimulationJob(job.id);
    expect(after.job.plan_cursor).toBeGreaterThan(0);
  });

  it("fails AI-use ticks when the owner org has no OpenRouter key", async () => {
    resetRegionSimulationJobsForTests();
    setOrgOpenRouterApiKeyForTests(null);
    const job = await enqueueRegionSimulation({
      ownerUserId: "owner-1",
      family: "ai_use",
      name: "Region",
      kind: "verification",
      flows: [{ id: "flow-1", name: "Flow", problems: ["P"] }],
      catalogIds: [AI_USE_CATALOG[0]!.id],
      samplesPerAiUse: 3,
    });
    const after = await tickRegionSimulationJob(job.id);
    expect(after.job.status).toBe("failed");
    expect(after.job.error).toBe(OPENROUTER_ORG_KEY_MISSING);
  });
  it("prevents concurrent parallel ticks from executing the same job simultaneously", async () => {
    resetRegionSimulationJobsForTests();
    setOrgOpenRouterApiKeyForTests("sk-or-concurrent");
    let openRouterCalls = 0;
    setOpenRouterFetchForTests(async () => {
      openRouterCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return new Response(
        JSON.stringify({
          id: `gen_${openRouterCalls}`,
          usage: { cost: 0.001 },
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                tool_calls: [
                  {
                    id: `call_${openRouterCalls}`,
                    type: "function",
                    function: { name: "board_done", arguments: "{}" },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    });
    const job = await enqueueRegionSimulation({
      ownerUserId: "owner-race",
      family: "ai_use",
      name: "Race Region",
      kind: "verification",
      flows: [{ id: "flow-race", name: "Flow", problems: ["P"] }],
      catalogIds: [AI_USE_CATALOG[0]!.id],
      samplesPerAiUse: 3,
    });
    const [a, b] = await Promise.all([
      tickRegionSimulationJob(job.id),
      tickRegionSimulationJob(job.id),
    ]);
    expect(openRouterCalls).toBe(1);
    expect([a.shouldContinue, b.shouldContinue].filter(Boolean)).toHaveLength(1);
  });
});

describe("org OpenRouter gate", () => {
  it("refuses AI-use enqueue when the org has no OpenRouter key", () => {
    for (const rel of [
      "app/api/dashboard/region-simulation/route.ts",
      "app/api/dashboard/knowledge-regions/[id]/simulation/route.ts",
      "app/api/lti/region-simulation/route.ts",
    ]) {
      const source = readFileSync(join(__dirname, "../..", rel), "utf8");
      expect(source).toContain("loadOpenRouterApiKeyForOwnerUser");
      expect(source).toContain("OPENROUTER_ORG_KEY_MISSING");
    }
    expect(
      readFileSync(join(__dirname, "../../lib/region-simulation-jobs.ts"), "utf8"),
    ).toContain("loadOpenRouterApiKeyForOwnerUser");
  });
});

describe("cron drain route", () => {
  it("authorizes with Bearer CRON_SECRET only and runs every minute", () => {
    const cron = readFileSync(
      join(__dirname, "../../app/api/cron/region-simulation-drain/route.ts"),
      "utf8",
    );
    expect(cron).toContain("Bearer");
    expect(cron).toContain("regionSimulationCronSecret");
    expect(cron).not.toContain("searchParams.get(\"secret\")");
    expect(cron).toContain("maxDuration = 60");
    const vercel = JSON.parse(
      readFileSync(join(__dirname, "../../vercel.json"), "utf8"),
    ) as { crons: Array<{ path: string; schedule: string }> };
    expect(vercel.crons[0]).toEqual({
      path: "/api/cron/region-simulation-drain",
      schedule: "* * * * *",
    });
  });
});

describe("ai-use figure space", () => {
  it("parses ai_use space and places close/far wedges", () => {
    expect(parseKnowledgeRegionFigureSpace("ai_use")).toBe("ai_use");
    const layout = placeKnowledgeRegionAiUsePoints({
      points: [
        {
          id: "p1",
          x: 0,
          y: 0,
          origin: "human",
          pointKind: "cohort",
          clusterId: null,
          identity: "A",
          vector: [0, 0, 1],
          unsysDistance: 0.2,
        },
      ],
      clusters: [{ id: "c1", strategyName: "GPT Mini · low", vector: [0, 0, 1] }],
      threshold: 0.35,
      map: { cx: 240, cy: 240, radius: 200 },
    });
    expect(layout.sections).toHaveLength(2);
    expect(layout.placed.has("p1")).toBe(true);
  });
});
