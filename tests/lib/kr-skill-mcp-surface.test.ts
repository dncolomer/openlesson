/**
 * Knowledge Region skill/MCP surface: shipped builders omit TAP/ILE/TAPBench
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
} from "@/lib/pow-api/integration-skill";
import {
  assertWorkspaceAllowsKnowledgeLinkMint,
  workspaceAllowsKnowledgeLinkMint,
} from "@/lib/workspace-kind";
import { STASH_API_BASE } from "@/lib/api/agent-api-paths";

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

const STASH_TOOLS = [
  "buffer_proof_of_work",
  "stash_proof_of_work",
  "submit_stashed_proof_of_work",
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
  it("filters the agent catalog: KR omits mint tools, standard keeps them", () => {
    const kr = agentToolSurfaceForWorkspace("knowledge_region");
    const standard = agentToolSurfaceForWorkspace("standard");
    const krNames = kr.map((t) => t.name);
    const standardNames = standard.map((t) => t.name);

    for (const name of KNOWLEDGE_LINK_MINT_TOOL_NAMES) {
      expect(krNames).not.toContain(name);
      expect(standardNames).toContain(name);
    }
    expect(krNames).toContain("upload_proof_of_work");
    expect(krNames).toContain("lwm_snapshot");
    expect(krNames).toContain("get_world_model");
    expect(krNames).toContain("get_knowledge_config");
    for (const name of STASH_TOOLS) {
      expect(krNames).toContain(name);
    }

    const krCatalog = mcpProofOfWorkCatalogForWorkspace("knowledge_region").map((t) => t.name);
    const stdCatalog = mcpProofOfWorkCatalogForWorkspace("standard").map((t) => t.name);
    expect(krCatalog).toEqual(krNames);
    expect(stdCatalog).toContain("create_tap_link");
    expect(krCatalog).not.toContain("create_tapbench_link");
  });

  it("buildIntegrationSkillInstructions omits mint for KR and documents PoW + Stash TAPBench", () => {
    const kr = buildIntegrationSkillInstructions(SKILL_REQUEST, KR_WORKSPACE, [], null, null);
    const standard = buildIntegrationSkillInstructions(
      SKILL_REQUEST,
      STANDARD_WORKSPACE,
      [{ id: "block-1", title: "Setup", description: "First project" }],
      null,
      null,
    );

    assertNoLinkMint("KR skill instructions", kr);
    expect(kr).toContain("upload_proof_of_work");
    expect(kr).toContain("lwm_snapshot");
    expect(kr).toContain("get_world_model");
    expect(kr).toContain("get_knowledge_config");
    expect(kr).toContain("knowledge_distance");
    for (const name of STASH_TOOLS) {
      expect(kr).toContain(name);
    }
    expect(kr).toContain(STASH_API_BASE);
    expect(kr).toContain("/proof-of-work-schema");
    expect(kr).toContain("/proof-of-work");
    expect(kr).not.toContain("/skill.md");

    expect(textExposesKnowledgeLinkMint(standard)).toBe(true);
    expect(standard).toContain("create_tap_link");
    expect(standard).toContain("list_tap_links");
    expect(standard).toContain("create_tapbench_link");
    expect(standard).toContain("list_tapbench_links");
    expect(standard).toContain("/skill.md");

    const krDoc = skillDocumentedToolsForWorkspace("knowledge_region").map((t) => t.name);
    const stdDoc = skillDocumentedToolsForWorkspace("standard").map((t) => t.name);
    expect(krDoc.some((n) => (KNOWLEDGE_LINK_MINT_TOOL_NAMES as readonly string[]).includes(n))).toBe(
      false,
    );
    expect(stdDoc).toContain("create_tap_link");
  });

  it("recommendIntegrationActions recommends Stash TAPBench on KR and TAP mint on standard", () => {
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
    expect(kr.some((a) => a.mcp_tool === "buffer_proof_of_work")).toBe(true);
    expect(kr.some((a) => a.rest_equivalent.includes(STASH_API_BASE))).toBe(true);
    expect(kr.some((a) => a.mcp_tool === "create_tap_link")).toBe(false);

    expect(standard.some((a) => a.mcp_tool === "create_tap_link")).toBe(true);
    expect(stdBlob).toContain("tap-links");
    expect(omittedKind.some((a) => a.mcp_tool === "create_tap_link")).toBe(true);
  });

  it("KR Integration copy and generate-skill paths use workspace kind; mint deny still holds", () => {
    const copy = knowledgeRegionIntegrationCopy();
    assertNoLinkMint("KR integration skillDescription", copy.skillDescription);
    assertNoLinkMint("KR integration mcpNote", copy.mcpNote);
    expect(copy.skillDescription).toContain("buffer_proof_of_work");
    expect(copy.skillDescription).toContain("stash_proof_of_work");
    expect(copy.skillDescription).toContain("submit_stashed_proof_of_work");
    expect(copy.skillDescription).toContain("/api/v3/stash");
    expect(copy.skillDescription).toContain("lwm_snapshot");
    expect(copy.mcpNote).toContain("/api/mcp");

    const panel = read("components/WorkspaceIntegrationPanel.tsx");
    expect(panel).toContain("knowledgeRegionIntegrationCopy");
    expect(panel).toContain("data-kr-integration-mcp-note");
    expect(panel).toContain("workspaceKind={workspaceKind}");
    expect(panel).toContain("settingsShowsKnowledgeLinks");
    expect(panel).toContain('showKnowledgeLinks && activeSubview === "guest-links"');

    const quick = read("components/IntegrationQuickAccess.tsx");
    expect(quick).toContain("isKnowledgeRegionWorkspace");
    expect(quick).toContain("showSkill = sections.includes(\"skill\") && !knowledgeRegion");

    const uiSkill = read("app/api/workspace/integration-skill/route.ts");
    const agentSkill = read("app/api/v3/pow/workspaces/[id]/integration-skill/route.ts");
    const mcpDispatch = read("lib/pow-api/mcp-tools/dispatch.ts");
    expect(uiSkill).toContain("workspace_kind: plan.workspace_kind");
    expect(agentSkill).toContain("workspace_kind");
    expect(agentSkill).toContain("workspace_kind: workspace.workspace_kind");
    expect(mcpDispatch).toContain("workspace_kind: workspace.workspace_kind");

    expect(workspaceAllowsKnowledgeLinkMint("knowledge_region")).toBe(false);
    expect(workspaceAllowsKnowledgeLinkMint("standard")).toBe(true);
    expect(assertWorkspaceAllowsKnowledgeLinkMint("knowledge_region").ok).toBe(false);
    expect(read("lib/pow-api/create-tap-link.ts")).toContain("workspaceAllowsKnowledgeLinkMint");
    expect(read("lib/pow-api/create-ile-link.ts")).toContain("workspaceAllowsKnowledgeLinkMint");
    expect(read("lib/pow-api/create-tapbench-link.ts")).toContain("workspaceAllowsKnowledgeLinkMint");
    expect(read("app/api/workspace/tap-links/route.ts")).toContain(
      "assertWorkspaceAllowsKnowledgeLinkMint",
    );
    expect(read("app/api/workspace/ile-links/route.ts")).toContain(
      "assertWorkspaceAllowsKnowledgeLinkMint",
    );
    expect(read("app/api/workspace/tapbench-links/route.ts")).toContain(
      "assertWorkspaceAllowsKnowledgeLinkMint",
    );

    const krSkill = buildIntegrationSkillInstructions(SKILL_REQUEST, KR_WORKSPACE, [], null, null);
    const krActions = recommendIntegrationActions({
      proof_of_work_artifacts: 6,
      blocks: 2,
      has_workspace_goal: true,
      workspace_kind: "knowledge_region",
    });
    const stdSkill = buildIntegrationSkillInstructions(
      SKILL_REQUEST,
      STANDARD_WORKSPACE,
      [],
      null,
      null,
    );

    writeScratch(
      "kr-skill-mcp-surface.log",
      [
        `kr_catalog=${agentToolSurfaceForWorkspace("knowledge_region").map((t) => t.name).join(",")}`,
        `std_catalog_has_create_tap_link=${agentToolSurfaceForWorkspace("standard").some((t) => t.name === "create_tap_link")}`,
        `kr_skill_has_stash=${STASH_TOOLS.every((n) => krSkill.includes(n))}`,
        `kr_skill_exposes_mint=${textExposesKnowledgeLinkMint(krSkill)}`,
        `std_skill_exposes_mint=${textExposesKnowledgeLinkMint(stdSkill)}`,
        `kr_actions=${krActions.map((a) => a.mcp_tool).join(",")}`,
        `kr_copy_stash=${copy.skillDescription.includes("buffer_proof_of_work")}`,
        `ui_skill_passes_kind=${uiSkill.includes("workspace_kind: plan.workspace_kind")}`,
        `agent_skill_passes_kind=${agentSkill.includes("workspace_kind: workspace.workspace_kind")}`,
        `mcp_skill_passes_kind=${mcpDispatch.includes("workspace_kind: workspace.workspace_kind")}`,
      ].join("\n") + "\n",
    );

    writeScratch(
      "kr-mint-deny.log",
      [
        `kr_allows=${workspaceAllowsKnowledgeLinkMint("knowledge_region")}`,
        `standard_allows=${workspaceAllowsKnowledgeLinkMint("standard")}`,
        `kr_assert=${JSON.stringify(assertWorkspaceAllowsKnowledgeLinkMint("knowledge_region"))}`,
        `tap_create_consults=${read("lib/pow-api/create-tap-link.ts").includes("workspaceAllowsKnowledgeLinkMint")}`,
        `ile_create_consults=${read("lib/pow-api/create-ile-link.ts").includes("workspaceAllowsKnowledgeLinkMint")}`,
        `tapbench_create_consults=${read("lib/pow-api/create-tapbench-link.ts").includes("workspaceAllowsKnowledgeLinkMint")}`,
      ].join("\n") + "\n",
    );
  });
});
