import {
  createAgentFlow,
  deleteAgentFlow,
  generateAgentFlowUnsysSeed,
  getAgentFlow,
  listAgentFlows,
  parseAgentFlowKind,
  updateAgentFlow,
  uploadAgentFlowFile,
} from "../agent-flow-management";
import { loadKnowledgeRegionCandidate } from "@/lib/knowledge-region-candidate";
import {
  McpProofOfWorkToolContext,
  evidenceToolResult,
  requireScope,
  stringArg,
} from "./helpers";

export async function callMcpProofOfWorkTool(
  name: string,
  args: Record<string, unknown>,
  ctx: McpProofOfWorkToolContext
) {
  const { auth } = ctx;

  if (name === "list_flows") {
    requireScope(auth.scopes, "workspaces:read");
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("No user available to list flows");
    const flows = await listAgentFlows({
      ownerUserId,
      kind: parseAgentFlowKind(args.kind) || undefined,
    });
    return await evidenceToolResult({ flows }, { endpoint: "list_flows" });
  }

  if (name === "create_flow") {
    requireScope(auth.scopes, "workspaces:write");
    const flow = await createAgentFlow(auth, undefined, args);
    return await evidenceToolResult({ flow }, { endpoint: "create_flow" });
  }

  if (name === "upload_flow_file") {
    requireScope(auth.scopes, "workspaces:write");
    const artifact = await uploadAgentFlowFile(auth, args);
    return await evidenceToolResult(
      {
        artifact,
        xai_file_id: artifact.xaiFileId,
        name: artifact.name,
        mime_type: artifact.mimeType ?? null,
      },
      { endpoint: "upload_flow_file" },
    );
  }

  if (name === "generate_flow_unsys_seed") {
    requireScope(auth.scopes, "workspaces:write");
    const generated = await generateAgentFlowUnsysSeed(args);
    return await evidenceToolResult(generated, { endpoint: "generate_flow_unsys_seed" });
  }

  if (name === "get_flow") {
    requireScope(auth.scopes, "workspaces:read");
    const flowId = stringArg(args, "flow_id");
    if (!flowId) throw new Error("flow_id is required.");
    const flow = await getAgentFlow(undefined, flowId, String(auth.user_id || ""));
    if (!flow) throw new Error("Flow not found.");
    return await evidenceToolResult({ flow }, { endpoint: "get_flow" });
  }

  if (name === "update_flow") {
    requireScope(auth.scopes, "workspaces:write");
    const flowId = stringArg(args, "flow_id");
    if (!flowId) throw new Error("flow_id is required.");
    const flow = await updateAgentFlow(auth, undefined, flowId, args);
    return await evidenceToolResult({ flow }, { endpoint: "update_flow" });
  }

  if (name === "delete_flow") {
    requireScope(auth.scopes, "workspaces:write");
    const flowId = stringArg(args, "flow_id");
    if (!flowId) throw new Error("flow_id is required.");
    const deleted = await deleteAgentFlow(auth, flowId);
    return await evidenceToolResult(deleted, { endpoint: "delete_flow" });
  }

  if (name === "get_knowledge_region_candidate") {
    requireScope(auth.scopes, "workspaces:read");
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("Not authenticated");
    const knowledgeRegionId = stringArg(args, "knowledge_region_id");
    const candidateId = stringArg(args, "candidate_id");
    if (!knowledgeRegionId || !candidateId) {
      throw new Error("knowledge_region_id and candidate_id are required.");
    }
    const loaded = await loadKnowledgeRegionCandidate({
      ownerUserId,
      knowledgeRegionId,
      candidateId,
      space: args.space,
    });
    if (!loaded.ok) throw new Error(loaded.message);
    return await evidenceToolResult(loaded.payload, { endpoint: "get_knowledge_region_candidate" });
  }

  throw new Error(`Unknown tool: ${name}`);
}
