import {
  createAgentFlow,
  deleteAgentFlow,
  getAgentFlow,
  listAgentFlows,
  parseAgentFlowKind,
  updateAgentFlow,
} from "../agent-flow-management";
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

  throw new Error(`Unknown tool: ${name}`);
}
