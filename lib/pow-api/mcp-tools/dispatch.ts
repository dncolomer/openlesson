import {
  createManagedWorkspace,
  listManagedWorkspaces,
  listWorkspaceBlocks,
  loadManagedWorkspace,
  presentManagedWorkspace,
  updateManagedWorkspace,
} from "../workspace-management";
import {
  createAgentFlow,
  deleteAgentFlow,
  getAgentFlow,
  linkAgentFlowToBlock,
  listAgentFlows,
  parseAgentFlowKind,
  updateAgentFlow,
} from "../agent-flow-management";
import {
  applyHeliosMapToolsForAgent,
  listHeliosMapToolsForAgent,
} from "../helios-map-agent";
import {
  agentToolFeature,
  workspaceFeatureDeniedMessage,
  workspaceSupportsFeature,
} from "@/lib/workspace-capabilities";
import {
  McpProofOfWorkToolContext,
  evidenceToolResult,
  loadWorkspace,
  requireScope,
  stringArg,
} from "./helpers";

export async function callMcpProofOfWorkTool(
  name: string,
  args: Record<string, unknown>,
  ctx: McpProofOfWorkToolContext
) {
  const { auth, supabase, origin } = ctx;
  const feature = agentToolFeature(name);
  if (feature) {
    const workspaceId = stringArg(args, "workspace_id");
    if (workspaceId) {
      const gated = await loadWorkspace(supabase, auth, workspaceId);
      if (!workspaceSupportsFeature(gated.workspace_kind, feature)) {
        throw new Error(workspaceFeatureDeniedMessage(gated.workspace_kind, feature));
      }
    }
  }
  if (name === "list_workspaces") {
    requireScope(auth.scopes, "workspaces:read");
    const payload = await listManagedWorkspaces(supabase, auth, {
      status: stringArg(args, "status"),
      limit: args.limit,
      offset: args.offset,
    });
    return await evidenceToolResult(payload, { endpoint: "list_workspaces" });
  }

  if (name === "get_workspace") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
    if (!workspace) throw new Error("Workspace not found.");
    const blocks = await listWorkspaceBlocks(supabase, workspaceId);
    return await evidenceToolResult(
      { workspace: presentManagedWorkspace(workspace as Record<string, unknown>), blocks },
      { endpoint: "get_workspace", workspace_id: workspaceId }
    );
  }

  if (name === "create_workspace") {
    requireScope(auth.scopes, "workspaces:write");
    const created = await createManagedWorkspace(supabase, auth, args);
    return await evidenceToolResult(created, { endpoint: "create_workspace" });
  }

  if (name === "update_workspace" || name === "update_workspace_settings") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const updated = await updateManagedWorkspace(supabase, auth, workspaceId, args);
    if (!updated) throw new Error("Workspace not found.");
    return await evidenceToolResult(updated, {
      endpoint: name,
      workspace_id: workspaceId,
    });
  }

  if (name === "get_workspace_settings") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
    if (!workspace) throw new Error("Workspace not found.");
    const presented = presentManagedWorkspace(workspace as Record<string, unknown>);
    return await evidenceToolResult(
      { workspace_id: workspaceId, settings: presented.settings },
      { endpoint: "get_workspace_settings", workspace_id: workspaceId },
    );
  }

  if (name === "list_blocks") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    await loadWorkspace(supabase, auth, workspaceId);
    const blocks = await listWorkspaceBlocks(supabase, workspaceId);
    return await evidenceToolResult(
      { blocks },
      { endpoint: "list_blocks", workspace_id: workspaceId }
    );
  }

  if (name === "update_blocks") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const updated = await updateManagedWorkspace(supabase, auth, workspaceId, {
      blocks: args.blocks,
    });
    if (!updated) throw new Error("Workspace not found.");
    return await evidenceToolResult(updated, {
      endpoint: "update_blocks",
      workspace_id: workspaceId,
    });
  }

  if (name === "list_map_tools") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
    if (!workspace) throw new Error("Workspace not found.");
    const payload = await listHeliosMapToolsForAgent(supabase, workspaceId);
    return await evidenceToolResult(payload, {
      endpoint: "list_map_tools",
      workspace_id: workspaceId,
    });
  }

  if (name === "apply_map_tool") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
    if (!workspace) throw new Error("Workspace not found.");
    const payload = await applyHeliosMapToolsForAgent({
      supabase,
      workspaceId,
      body: args,
    });
    return await evidenceToolResult(payload, {
      endpoint: "apply_map_tool",
      workspace_id: workspaceId,
    });
  }

  if (name === "list_flows") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("No user available to list flows");
    if (workspaceId) {
      const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
      if (!workspace) throw new Error("Workspace not found.");
    }
    const flows = await listAgentFlows({
      ownerUserId,
      workspaceId: workspaceId || undefined,
      kind: parseAgentFlowKind(args.kind) || undefined,
    });
    return await evidenceToolResult(
      { flows },
      { endpoint: "list_flows", workspace_id: workspaceId || undefined },
    );
  }

  if (name === "create_flow") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    if (workspaceId) {
      const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
      if (!workspace) throw new Error("Workspace not found.");
    }
    const flow = await createAgentFlow(auth, workspaceId, args);
    return await evidenceToolResult(
      { flow },
      { endpoint: "create_flow", workspace_id: flow.workspace_id || undefined },
    );
  }

  if (name === "get_flow") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    const flowId = stringArg(args, "flow_id");
    if (!flowId) throw new Error("flow_id is required.");
    const flow = await getAgentFlow(workspaceId, flowId, String(auth.user_id || ""));
    if (!flow) throw new Error("Flow not found.");
    return await evidenceToolResult(
      { flow },
      { endpoint: "get_flow", workspace_id: flow.workspace_id || undefined },
    );
  }

  if (name === "update_flow") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    const flowId = stringArg(args, "flow_id");
    if (!flowId) throw new Error("flow_id is required.");
    const flow = await updateAgentFlow(auth, workspaceId, flowId, args);
    return await evidenceToolResult(
      { flow },
      { endpoint: "update_flow", workspace_id: flow.workspace_id || undefined },
    );
  }

  if (name === "delete_flow") {
    requireScope(auth.scopes, "workspaces:write");
    const flowId = stringArg(args, "flow_id");
    if (!flowId) throw new Error("flow_id is required.");
    const deleted = await deleteAgentFlow(auth, flowId);
    return await evidenceToolResult(deleted, { endpoint: "delete_flow" });
  }

  if (name === "link_flow") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    const flowId = stringArg(args, "flow_id");
    const blockId = stringArg(args, "block_id");
    if (!workspaceId || !flowId) throw new Error("workspace_id and flow_id are required.");
    if (!blockId) throw new Error("block_id is required.");
    const linked = await linkAgentFlowToBlock(supabase, auth, workspaceId, flowId, blockId);
    return await evidenceToolResult(linked, {
      endpoint: "link_flow",
      workspace_id: workspaceId,
    });
  }

  throw new Error(`Unknown tool: ${name}`);
}