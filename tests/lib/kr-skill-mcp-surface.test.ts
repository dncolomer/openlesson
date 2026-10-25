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
  COPY_LEARNING_TO_VERIFICATION_GONE_MESSAGE,
  copyLearningWorkspaceToVerification,
  workspaceAllowsCopyToVerification,
} from "@/lib/copy-learning-to-verification";
import {
  assertWorkspaceAllowsKnowledgeLinkMint,
  workspaceAllowsKnowledgeLinkMint,
} from "@/lib/workspace-kind";
import { POW_API_BASE, WORKSPACE_API_BASE } from "@/lib/api/agent-api-paths";

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

const HEADLESS_TOOLS = [
  "start_session",
  "upload_proof_of_work",
  "end_session",
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
    for (const name of ["create_workspace", "list_blocks", ...HEADLESS_TOOLS] as const) {
      expect(krNames).toContain(name);
      expect(standardNames).toContain(name);
    }
    expect(standardNames).toContain("list_map_tools");
    expect(standardNames).toContain("apply_map_tool");
    expect(krNames).not.toContain("list_map_tools");
    expect(krNames).not.toContain("apply_map_tool");
    expect(krNames).not.toContain("lwm_snapshot");
    expect(standardNames).not.toContain("lwm_snapshot");
    expect(krNames).not.toContain("buffer_proof_of_work");

    const krCatalog = mcpProofOfWorkCatalogForWorkspace("knowledge_region").map((t) => t.name);
    const stdCatalog = mcpProofOfWorkCatalogForWorkspace("standard").map((t) => t.name);
    expect(krCatalog).toEqual(krNames);
    expect(stdCatalog).not.toContain("create_tap_link");
    expect(stdCatalog).toContain("list_blocks");
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
    expect(kr).toContain("upload_proof_of_work");
    expect(kr).toContain("start_session");
    expect(kr).toContain("end_session");
    expect(kr).not.toContain("lwm_snapshot");
    expect(kr).not.toContain("buffer_proof_of_work");
    expect(kr).toContain(POW_API_BASE);
    expect(kr).toContain(WORKSPACE_API_BASE);

    expect(textExposesKnowledgeLinkMint(standard)).toBe(false);
    expect(standard).not.toContain("create_tap_link");
    expect(standard).toContain("upload_proof_of_work");
    expect(standard).toContain("list_blocks");
    expect(standard).toContain("Learning workspace");

    const krDoc = skillDocumentedToolsForWorkspace("knowledge_region").map((t) => t.name);
    const stdDoc = skillDocumentedToolsForWorkspace("standard").map((t) => t.name);
    expect(krDoc.some((n) => (KNOWLEDGE_LINK_MINT_TOOL_NAMES as readonly string[]).includes(n))).toBe(
      false,
    );
    expect(stdDoc).toContain("list_blocks");
    expect(stdDoc).not.toContain("create_tap_link");
  });

  it("recommendIntegrationActions recommends headless PoW on both kinds", () => {
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
    expect(kr.some((a) => a.mcp_tool === "start_session" || a.mcp_tool === "upload_proof_of_work")).toBe(
      true,
    );
    expect(kr.some((a) => a.rest_equivalent.includes(POW_API_BASE) || a.rest_equivalent.includes("/sessions"))).toBe(
      true,
    );
    expect(kr.some((a) => a.mcp_tool === "create_tap_link")).toBe(false);

    expect(standard.some((a) => a.mcp_tool === "list_blocks")).toBe(true);
    expect(standard.some((a) => a.mcp_tool === "create_tap_link")).toBe(false);
    expect(stdBlob).not.toContain("tap-links");
    expect(omittedKind.some((a) => a.mcp_tool === "list_blocks")).toBe(true);
  });

  it("KR Integration copy and generate-skill paths use workspace kind; mint deny still holds", async () => {
    const copy = knowledgeRegionIntegrationCopy();
    assertNoLinkMint("KR integration skillDescription", copy.skillDescription);
    assertNoLinkMint("KR integration mcpNote", copy.mcpNote);
    expect(copy.skillDescription).toContain("headless proof-of-work");
    expect(copy.skillDescription).toContain("/api/v3/pow");
    expect(copy.skillDescription).toContain("/api/v3/workspaces");
    expect(copy.skillDescription).not.toContain("lwm_snapshot");
    expect(copy.mcpNote).toContain("/api/mcp");
    expect(workspaceSettingsIntegrationCopy("knowledge_region")).toEqual(copy);
    expect(workspaceSettingsIntegrationCopy("calibration")).toEqual(copy);
    expect(workspaceSettingsIntegrationCopy("standard")).toEqual(
      learningWorkspaceIntegrationCopy(),
    );
    expect(workspaceAllowsCopyToVerification("standard")).toBe(false);
    expect(workspaceAllowsCopyToVerification("knowledge_region")).toBe(false);
    expect(workspaceAllowsCopyToVerification("calibration")).toBe(false);
    await expect(
      copyLearningWorkspaceToVerification({} as never, {
        sourceWorkspaceId: "ws-1",
        ownerUserId: "user-1",
        title: "Copy",
      }),
    ).rejects.toThrow(COPY_LEARNING_TO_VERIFICATION_GONE_MESSAGE);
    expect(COPY_LEARNING_TO_VERIFICATION_GONE_MESSAGE).toContain("/api/dashboard/flows");
    const createTool = read("lib/pow-api/mcp-tools/evidence-tools.ts");
    expect(createTool).toContain("Create a Learning workspace only");
    expect(createTool).toContain("/api/dashboard/flows");
    expect(createTool).not.toContain("kind=learning|verification");

    const panel = read("components/WorkspaceIntegrationPanel.tsx");
    expect(panel).toContain("workspaceSettingsIntegrationCopy");
    expect(panel).not.toContain("workspaceAllowsCopyToVerification");
    expect(panel).not.toContain("WorkspaceCopyToVerification");
    expect(panel).toContain("data-kr-integration-mcp-note={isNoMap");
    expect(panel).toContain("data-kr-integration-skill={isNoMap");
    expect(panel).toContain("workspaceKind={workspaceKind}");
    expect(panel).not.toContain("!isKnowledgeRegion ?");
    expect(panel).not.toContain("WorkspaceKnowledgePortalPanel");
    expect(panel).not.toContain('activeSubview === "knowledge-portal"');
    expect(panel).not.toContain('activeSubview === "guest-links"');

    const quick = read("components/IntegrationQuickAccess.tsx");
    expect(quick).toContain("isNoMapWorkspace");
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
    expect(read("lib/pow-api/create-learn-link.ts")).toContain("workspaceAllowsKnowledgeLinkMint");
    expect(existsSync(join(ROOT, "lib/pow-api/create-tapbench-link.ts"))).toBe(false);
    expect(read("app/api/workspace/tap-links/route.ts")).toContain(
      "assertWorkspaceAllowsKnowledgeLinkMint",
    );
    expect(read("app/api/workspace/learn-links/route.ts")).toContain(
      "assertWorkspaceAllowsKnowledgeLinkMint",
    );
    expect(existsSync(join(ROOT, "app/api/workspace/tapbench-links/route.ts"))).toBe(
      false,
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
        `kr_skill_has_headless=${HEADLESS_TOOLS.every((n) => krSkill.includes(n))}`,
        `kr_skill_exposes_mint=${textExposesKnowledgeLinkMint(krSkill)}`,
        `std_skill_exposes_mint=${textExposesKnowledgeLinkMint(stdSkill)}`,
        `kr_actions=${krActions.map((a) => a.mcp_tool).join(",")}`,
        `kr_copy_headless=${copy.skillDescription.includes("/api/v3/pow")}`,
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
        `ile_create_consults=${read("lib/pow-api/create-learn-link.ts").includes("workspaceAllowsKnowledgeLinkMint")}`,
        `tapbench_create_file_exists=${existsSync(join(ROOT, "lib/pow-api/create-tapbench-link.ts"))}`,
      ].join("\n") + "\n",
    );
  });
});
