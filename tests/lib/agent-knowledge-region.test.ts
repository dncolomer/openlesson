import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  KNOWLEDGE_REGION_API_BASE,
  KNOWLEDGE_REGION_JOBS_API_PATH,
  KNOWLEDGE_REGION_OPTIONS_API_PATH,
} from "@/lib/api/agent-api-paths";
import { AGENT_TOOL_SURFACE, agentToolsByFamily } from "@/lib/pow-api/agent-tool-surface";
import {
  presentAgentKnowledgeRegionDetails,
  presentAgentSimulationJob,
} from "@/lib/pow-api/agent-knowledge-region-management";
import { MCP_EVIDENCE_TOOLS } from "@/lib/pow-api/mcp-tools/evidence-tools";
import { completeFlowEmbedding } from "@/lib/flow-embedding";
import { presentKnowledgeRegionDetails } from "@/lib/knowledge-region-details";
import type { DataStudioEmbeddingRow } from "@/lib/data-studio-view";
import type { RegionSimulationJobRow } from "@/lib/region-simulation-jobs";
import { REGION_SIMULATION_WIZARD_STEPS } from "@/lib/region-simulation";

const ROOT = join(__dirname, "../..");

function embeddingRow(id: string, identity: string, source: string): DataStudioEmbeddingRow {
  const record = completeFlowEmbedding({
    flowKind: "verify",
    pow: [
      {
        type: "tool",
        tool_name: source,
        tool_action: "speech_stop",
        timestamp_ms: 1,
        payload: "walk",
        metadata: { transcript: "walk", text: "walk" },
      },
    ],
  });
  return {
    id,
    workspace_id: "ws-1",
    owner_user_id: "me",
    flow_kind: "verify",
    flow_id: "flow-a",
    run_id: id,
    identity,
    source,
    vector: record.vector,
    raw: record.raw,
    embedding_model_id: record.embedding_model_id,
    created_at: "2026-11-09T00:00:00.000Z",
  };
}

const KR_TOOLS = [
  "list_knowledge_regions",
  "get_knowledge_region_options",
  "create_knowledge_region",
  "get_knowledge_region",
  "update_knowledge_region",
  "delete_knowledge_region",
  "simulate_knowledge_region",
  "get_knowledge_region_job",
  "get_knowledge_region_run",
  "get_knowledge_region_candidate",
  "get_knowledge_region_uncertainty_model",
] as const;

describe("public Knowledge Regions agent API", () => {
  it("ships CRUD + wizard + retrieve routes", () => {
    const routes = [
      "app/api/v3/knowledge-regions/route.ts",
      "app/api/v3/knowledge-regions/options/route.ts",
      "app/api/v3/knowledge-regions/jobs/[jobId]/route.ts",
      "app/api/v3/knowledge-regions/[id]/route.ts",
      "app/api/v3/knowledge-regions/[id]/simulation/route.ts",
      "app/api/v3/knowledge-regions/[id]/runs/[runId]/route.ts",
      "app/api/v3/knowledge-regions/[id]/candidates/[candidateId]/route.ts",
      "app/api/v3/knowledge-regions/[id]/candidates/[candidateId]/uncertainty-model/route.ts",
    ];
    for (const rel of routes) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(true);
    }
    expect(KNOWLEDGE_REGION_API_BASE).toBe("/api/v3/knowledge-regions");
    expect(KNOWLEDGE_REGION_OPTIONS_API_PATH).toBe("/api/v3/knowledge-regions/options");
    expect(KNOWLEDGE_REGION_JOBS_API_PATH).toBe("/api/v3/knowledge-regions/jobs");
  });

  it("MCP schemas match the dashboard wizard fields", () => {
    const names = agentToolsByFamily("knowledge_region").map((tool) => tool.name);
    expect(names).toEqual([...KR_TOOLS]);
    expect(AGENT_TOOL_SURFACE).toHaveLength(19);
    const create = MCP_EVIDENCE_TOOLS.find((tool) => tool.name === "create_knowledge_region");
    const simulate = MCP_EVIDENCE_TOOLS.find((tool) => tool.name === "simulate_knowledge_region");
    const options = MCP_EVIDENCE_TOOLS.find((tool) => tool.name === "get_knowledge_region_options");
    expect(create?.inputSchema.required).toEqual(["organization_id", "name"]);
    expect(options?.inputSchema.required).toEqual(["organization_id"]);
    expect(options?.inputSchema.properties).toHaveProperty("organization_id");
    for (const tool of [create, simulate]) {
      const properties = tool?.inputSchema.properties ?? {};
      expect(properties).toHaveProperty("protocol_ids");
      expect(properties).toHaveProperty("strategy_ids");
      expect(properties).toHaveProperty("custom_strategies");
      expect(properties).toHaveProperty("samples_per_strategy");
      expect(properties).toHaveProperty("include_human_data");
      expect(properties).toHaveProperty("ai_use_catalog_ids");
      expect(properties).toHaveProperty("samples_per_ai_use");
    }
    expect(REGION_SIMULATION_WIZARD_STEPS).toEqual([
      "name",
      "protocols",
      "explore",
      "ai-use",
      "run",
    ]);
  });

  it("presents details without vectors and jobs in snake_case", () => {
    const simulated = embeddingRow("sim-1", "Simulated · Exploit-heavy", "simulated");
    const details = presentKnowledgeRegionDetails({
      flowNames: { "flow-a": "Limits" },
      parent: {
        id: "parent",
        name: "Limits styles",
        description: "region-simulation: 1 flows · Exploit-heavy · 3/strategy · 0 real",
        owner_user_id: "me",
        workspace_id: "ws-1",
        subject_count: 1,
        created_at: "2026-11-09",
        verify_flow_id: "flow-a",
        centroid: simulated.vector,
        cosine_threshold: 0.5,
      },
      clusters: [
        {
          id: "c-exploit",
          name: "Limits styles · Exploit-heavy",
          description: "region-simulation-cluster:exploit-heavy",
          owner_user_id: "me",
          subject_count: 1,
          centroid: simulated.vector,
          cosine_threshold: 0.5,
        },
      ],
      embeddings: [simulated],
    });
    expect(details).toBeTruthy();
    if (!details) return;
    const presented = presentAgentKnowledgeRegionDetails(details);
    expect(presented.protocols).toEqual([{ id: "flow-a", name: "Limits" }]);
    expect(presented.samples[0]).toMatchObject({
      id: "sim-1",
      run_id: "sim-1",
      origin: expect.any(String),
    });
    expect(JSON.stringify(presented.samples[0])).not.toContain("embedding");
    expect(presented).not.toHaveProperty("embeddings");

    const job: RegionSimulationJobRow = {
      id: "job-1",
      owner_user_id: "me",
      region_id: "parent",
      product: "verification",
      status: "running",
      family: "exploration",
      follow_up_job_id: "job-2",
      plan: {
        family: "exploration",
        name: "Limits styles",
        kind: "verification",
        flows: [],
        strategies: [],
        samplesPerStrategy: 12,
        includeHumanData: false,
        catalogIds: [],
        samplesPerAiUse: 6,
        items: [],
      },
      plan_cursor: 1,
      checkpoint: null,
      lease_owner: null,
      lease_until: null,
      progress: [],
      result: null,
      cost_usd: 0.12,
      error: null,
      created_at: "2026-11-09T00:00:00.000Z",
      updated_at: "2026-11-09T00:00:00.000Z",
    };
    const publicJob = presentAgentSimulationJob(job, {
      explorationJobId: "job-1",
      aiUseJobId: "job-2",
      pendingAiUseCatalogIds: ["grok-low"],
    });
    expect(publicJob).toMatchObject({
      type: "job",
      job_id: "job-1",
      family: "exploration",
      status: "running",
      knowledge_region_id: "parent",
      follow_up_job_id: "job-2",
      exploration_job_id: "job-1",
      ai_use_job_id: "job-2",
      pending_ai_use_catalog_ids: ["grok-low"],
      plan_cursor: 1,
      plan_length: 0,
      cost_usd: 0.12,
    });
  });

  it("documents the family for coding agents", () => {
    const coding = readFileSync(join(ROOT, "public/coding-agents.md"), "utf8");
    const spec = readFileSync(join(ROOT, "docs/KNOWLEDGE_REGION_API.md"), "utf8");
    for (const src of [coding, spec]) {
      expect(src).toContain("/api/v3/knowledge-regions/options");
      expect(src).toContain("ai_use_catalog_ids");
      expect(src).toContain("strategy_ids");
      expect(src).toContain("custom_strategies");
      expect(src).toContain("include_human_data");
      expect(src).toContain("get_knowledge_region_run");
      expect(src).toContain("get_knowledge_region_uncertainty_model");
    }
  });
});
