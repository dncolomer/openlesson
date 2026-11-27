/**
 * Knowledge Region skill/MCP surface: shipped builders omit TAP/TAP Learning/TAPBench
 * link mint and document PoW + Stash TAPBench. Standard workspaces keep mint.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  agentToolSurfaceForWorkspace,
  KNOWLEDGE_LINK_MINT_PATH_FRAGMENTS,
  KNOWLEDGE_LINK_MINT_TOOL_NAMES,
  skillDocumentedToolsForWorkspace,
  textExposesKnowledgeLinkMint,
} from "@/lib/pow-api/agent-tool-surface";
import { mcpProofOfWorkCatalogForWorkspace } from "@/lib/pow-api/mcp-proof-of-work-catalog";
import { recommendIntegrationActions } from "@/lib/pow-api/integration-discovery";
import {
  buildIntegrationSkillInstructions,
  knowledgeRegionIntegrationCopy,
  learningWorkspaceIntegrationCopy,
  workspaceSettingsIntegrationCopy,
} from "@/lib/pow-api/integration-skill";
import {
  AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE,
  assertWorkspaceAllowsKnowledgeLinkMint,
  workspaceAllowsKnowledgeLinkMint,
} from "@/lib/workspace-kind";
import { WORKSPACE_API_BASE } from "@/lib/api/agent-api-paths";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-c0ce1e0f08e6/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

const KR_WORKSPACE = {
  id: "kr-ws-1",
  title: "Knowledge Region",
  root_topic: "External PoW",
  workspace_kind: "knowledge_region" as const,
};

const STANDARD_WORKSPACE = {
  id: "std-ws-1",
  title: "Map workspace",
  root_topic: "Onboarding",
  workspace_kind: "standard" as const,
};

const SKILL_REQUEST = {
  integration_name: "Partner Agent",
  base_url: "https://uncertain.systems",
  eval_definition: "Verify partner workflow",
};

const FLOW_TOOLS = [
  "create_protocol",
  "list_protocols",
  "get_protocol",
] as const;

function assertNoLinkMint(label: string, text: string) {
  expect(textExposesKnowledgeLinkMint(text), `${label} exposes link mint`).toBe(false);
  for (const name of KNOWLEDGE_LINK_MINT_TOOL_NAMES) {
    expect(text, `${label} contains ${name}`).not.toContain(name);
  }
  for (const frag of KNOWLEDGE_LINK_MINT_PATH_FRAGMENTS) {
    expect(text, `${label} contains ${frag}`).not.toContain(frag);
  }
}

describe("KR vs standard skill/MCP surface (shipped builders)", () => {
  it("shares the two public APIs for both workspace kinds (no mint, no Snapshot/Stash)", () => {
    const kr = agentToolSurfaceForWorkspace("knowledge_region");
    const standard = agentToolSurfaceForWorkspace("standard");
    const krNames = kr.map((t) => t.name);
    const standardNames = standard.map((t) => t.name);

    for (const name of KNOWLEDGE_LINK_MINT_TOOL_NAMES) {
      expect(krNames).not.toContain(name);
      expect(standardNames).not.toContain(name);
    }
    for (const name of FLOW_TOOLS) {
      expect(krNames).toContain(name);
      expect(standardNames).toContain(name);
    }
    expect(krNames).not.toContain("create_workspace");
    expect(krNames).not.toContain("list_blocks");
    expect(krNames).not.toContain("list_map_tools");
    expect(krNames).not.toContain("apply_map_tool");
    expect(standardNames).not.toContain("list_map_tools");
    expect(krNames).toEqual(standardNames);
    expect(krNames).not.toContain("lwm_snapshot");
    expect(standardNames).not.toContain("lwm_snapshot");
    expect(krNames).not.toContain("buffer_proof_of_work");
    expect(krNames).not.toContain("create_flow");

    const krCatalog = mcpProofOfWorkCatalogForWorkspace("knowledge_region").map((t) => t.name);
    const stdCatalog = mcpProofOfWorkCatalogForWorkspace("standard").map((t) => t.name);
    expect(krCatalog).toEqual(krNames);
    expect(stdCatalog).not.toContain("create_tap_link");
    expect(stdCatalog).not.toContain("list_blocks");
    expect(krCatalog).not.toContain("create_tapbench_link");
  });

  it("buildIntegrationSkillInstructions omits mint and documents the two public APIs", () => {
    const kr = buildIntegrationSkillInstructions(SKILL_REQUEST, KR_WORKSPACE, [], null, null);
    const standard = buildIntegrationSkillInstructions(
      SKILL_REQUEST,
      STANDARD_WORKSPACE,
      [{ id: "block-1", title: "Setup", description: "First project" }],
      null,
      null,
    );

    assertNoLinkMint("KR skill instructions", kr);
    expect(kr).toContain("create_protocol");
    expect(kr).not.toContain("create_flow");
    expect(kr).not.toContain("link_flow");
    expect(kr).not.toContain("apply_map_tool");
    expect(kr).not.toContain("lwm_snapshot");
    expect(kr).not.toContain("buffer_proof_of_work");

    expect(textExposesKnowledgeLinkMint(standard)).toBe(false);
    expect(standard).not.toContain("create_tap_link");
    expect(standard).toContain("create_protocol");
    expect(standard).not.toContain("list_blocks");

    const krDoc = skillDocumentedToolsForWorkspace("knowledge_region").map((t) => t.name);
    const stdDoc = skillDocumentedToolsForWorkspace("standard").map((t) => t.name);
    expect(krDoc.some((n) => (KNOWLEDGE_LINK_MINT_TOOL_NAMES as readonly string[]).includes(n))).toBe(
      false,
    );
    expect(stdDoc).not.toContain("list_blocks");
    expect(stdDoc).not.toContain("create_tap_link");
    expect(stdDoc).toContain("create_protocol");
  });

  it("recommendIntegrationActions recommends map and flow tools on both kinds", () => {
    const kr = recommendIntegrationActions({
      proof_of_work_artifacts: 6,
      blocks: 2,
      has_workspace_goal: true,
      workspace_kind: "knowledge_region",
    });
    const standard = recommendIntegrationActions({
      proof_of_work_artifacts: 6,
      blocks: 2,
      has_workspace_goal: true,
      workspace_kind: "standard",
    });
    const omittedKind = recommendIntegrationActions({
      proof_of_work_artifacts: 6,
      blocks: 2,
      has_workspace_goal: true,
    });

    const krBlob = JSON.stringify(kr);
    const stdBlob = JSON.stringify(standard);
    assertNoLinkMint("KR recommended actions", krBlob);
    expect(kr.some((a) => a.mcp_tool === "create_protocol")).toBe(true);
    expect(kr.some((a) => a.mcp_tool === "create_knowledge_region")).toBe(true);
    expect(kr.some((a) => a.rest_equivalent.includes("/protocols"))).toBe(true);
    expect(kr.some((a) => a.mcp_tool === "create_tap_link")).toBe(false);

    expect(standard.some((a) => a.mcp_tool === "create_protocol")).toBe(true);
    expect(standard.some((a) => a.mcp_tool === "create_tap_link")).toBe(false);
    expect(stdBlob).not.toContain("tap-links");
    expect(omittedKind.some((a) => a.mcp_tool === "list_protocols")).toBe(true);
  });

});
