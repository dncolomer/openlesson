import {
  createAgentProtocol,
  deleteAgentProtocol,
  generateAgentFlowUnsysSeed,
  getAgentProtocol,
  listAgentProtocols,
  updateAgentProtocol,
  uploadAgentFlowFile,
} from "../agent-flow-management";
import { loadKnowledgeRegionCandidate } from "@/lib/knowledge-region-candidate";
import { rejectedProtocolKind } from "@/lib/product-flow";
import {
  McpProofOfWorkToolContext,
  evidenceToolResult,
  requireScope,
  stringArg,
} from "./helpers";

function assertNoRetiredKind(args: Record<string, unknown>) {
  const kind = args.kind ?? args.type ?? args.product;
  if (rejectedProtocolKind(kind)) {
    throw new Error("Only knowledge verification protocols are supported");
  }
}

export async function callMcpProofOfWorkTool(
  name: string,
  args: Record<string, unknown>,
  ctx: McpProofOfWorkToolContext
) {
  const { auth } = ctx;

  if (name === "list_protocols") {
    requireScope(auth.scopes, "workspaces:read");
    assertNoRetiredKind(args);
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("No user available to list protocols");
    const protocols = await listAgentProtocols({
      ownerUserId,
    });
    return await evidenceToolResult({ protocols }, { endpoint: "list_protocols" });
  }

  if (name === "create_protocol") {
    requireScope(auth.scopes, "workspaces:write");
    assertNoRetiredKind(args);
    const protocol = await createAgentProtocol(auth, undefined, args);
    return await evidenceToolResult({ protocol }, { endpoint: "create_protocol" });
  }

  if (name === "upload_protocol_file") {
    requireScope(auth.scopes, "workspaces:write");
    const artifact = await uploadAgentFlowFile(auth, args);
    return await evidenceToolResult(
      {
        artifact,
        xai_file_id: artifact.xaiFileId,
        name: artifact.name,
        mime_type: artifact.mimeType ?? null,
      },
      { endpoint: "upload_protocol_file" },
    );
  }

  if (name === "generate_protocol_unsys_seed") {
    requireScope(auth.scopes, "workspaces:write");
    const generated = await generateAgentFlowUnsysSeed(args);
    return await evidenceToolResult(generated, { endpoint: "generate_protocol_unsys_seed" });
  }

  if (name === "get_protocol") {
    requireScope(auth.scopes, "workspaces:read");
    const protocolId = stringArg(args, "protocol_id");
    if (!protocolId) throw new Error("protocol_id is required.");
    const protocol = await getAgentProtocol(undefined, protocolId, String(auth.user_id || ""));
    if (!protocol) throw new Error("Protocol not found.");
    return await evidenceToolResult({ protocol }, { endpoint: "get_protocol" });
  }

  if (name === "update_protocol") {
    requireScope(auth.scopes, "workspaces:write");
    assertNoRetiredKind(args);
    const protocolId = stringArg(args, "protocol_id");
    if (!protocolId) throw new Error("protocol_id is required.");
    const protocol = await updateAgentProtocol(auth, undefined, protocolId, args);
    return await evidenceToolResult({ protocol }, { endpoint: "update_protocol" });
  }

  if (name === "delete_protocol") {
    requireScope(auth.scopes, "workspaces:write");
    const protocolId = stringArg(args, "protocol_id");
    if (!protocolId) throw new Error("protocol_id is required.");
    const deleted = await deleteAgentProtocol(auth, protocolId);
    return await evidenceToolResult(deleted, { endpoint: "delete_protocol" });
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
