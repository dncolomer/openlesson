import {
  generateWorkspaceProofOfWorkSpec,
  buildProofOfWorkSchemaRequestFromIntegration,
  resolveEvalDefinition,
} from "../proof-of-work-integration";
import {
  createManagedWorkspace,
  getAccountSettings,
  listManagedWorkspaces,
  listWorkspaceBlocks,
  loadManagedWorkspace,
  presentManagedWorkspace,
  updateAccountSettings,
  updateManagedWorkspace,
} from "../workspace-management";
import {
  endHeadlessSession,
  getHeadlessSession,
  HeadlessSessionError,
  parseHeadlessFlowKind,
  presentHeadlessSession,
  startHeadlessSession,
} from "../headless-session";
import { ingestHeadlessProofForWorkspace } from "../headless-session-run";
import {
  buildIntegrationSkillInstructions,
  buildIntegrationSkillPrompt,
  deriveSkillName,
  deriveSuggestedSharePath,
  parseIntegrationSkillRequest,
} from "../integration-skill";
import { withCanvasTapSimulationSkill } from "../pow-model-agent-contract";
import {
  applyHeliosMapToolsForAgent,
  listHeliosMapToolsForAgent,
} from "../helios-map-agent";
import { buildWorkspacePerformanceContext } from "../performance-context";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";
import { getFlowEmbedding, listFlowEmbeddings, presentFlowEmbedding } from "@/lib/flow-embedding-store";
import {
  agentToolFeature,
  workspaceFeatureDeniedMessage,
  workspaceSupportsFeature,
} from "@/lib/workspace-capabilities";
import {
  McpProofOfWorkToolContext,
  assertBlockInWorkspace,
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

  if (name === "get_account_settings") {
    requireScope(auth.scopes, "workspaces:read");
    const account = await getAccountSettings(supabase, auth);
    return await evidenceToolResult(account, { endpoint: "get_account_settings" });
  }

  if (name === "update_account_settings") {
    requireScope(auth.scopes, "workspaces:write");
    const account = await updateAccountSettings(supabase, auth, args);
    return await evidenceToolResult(account, { endpoint: "update_account_settings" });
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

  if (name === "start_session") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
    if (!workspace) throw new Error("Workspace not found.");
    const flowKind = parseHeadlessFlowKind(args.flow_kind);
    if (!flowKind) throw new Error("flow_kind must be calibrate, learn, or verify.");
    const blockId = stringArg(args, "block_id");
    let chapterTitle = stringArg(args, "chapter_title") || "";
    let chapterBrief = stringArg(args, "chapter_brief") || "";
    if (blockId) {
      const { data: block } = await supabase
        .from("blocks")
        .select("id, title, description")
        .eq("id", blockId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!block) throw new Error("Block not found in this workspace.");
      chapterTitle = chapterTitle || String(block.title || "");
      chapterBrief = chapterBrief || String(block.description || "");
    }
    if (!chapterTitle) {
      chapterTitle = String(workspace.title || workspace.root_topic || "Session");
    }
    if (!chapterBrief) {
      chapterBrief = String(workspace.notes || workspace.description || "");
    }
    const session = await startHeadlessSession({
      workspaceId,
      blockId,
      flowKind,
      catalogSize: args.catalog_size ?? workspace.learning_model_size,
      durationMinutes: args.duration_minutes,
      chapterTitle,
      chapterBrief,
    });
    return await evidenceToolResult(presentHeadlessSession(session), {
      endpoint: "start_session",
      workspace_id: workspaceId,
    });
  }

  if (name === "get_session") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    const sessionId = stringArg(args, "session_id");
    if (!workspaceId || !sessionId) throw new Error("workspace_id and session_id are required.");
    await loadWorkspace(supabase, auth, workspaceId);
    const session = await getHeadlessSession(sessionId);
    if (!session || session.workspace_id !== workspaceId) throw new Error("Session not found.");
    return await evidenceToolResult(presentHeadlessSession(session), {
      endpoint: "get_session",
      workspace_id: workspaceId,
    });
  }

  if (name === "end_session") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    const sessionId = stringArg(args, "session_id");
    if (!workspaceId || !sessionId) throw new Error("workspace_id and session_id are required.");
    await loadWorkspace(supabase, auth, workspaceId);
    const session = await getHeadlessSession(sessionId);
    if (!session || session.workspace_id !== workspaceId) throw new Error("Session not found.");
    const ended = await endHeadlessSession(sessionId);
    return await evidenceToolResult(presentHeadlessSession(ended), {
      endpoint: "end_session",
      workspace_id: workspaceId,
    });
  }

  if (name === "generate_integration_skill") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");

    const request = parseIntegrationSkillRequest({
      integration_name: args.integration_name,
      eval_definition: args.eval_definition,
      partner_description: args.partner_description,
      block_id: args.block_id,
      base_url: origin,
      prefetch_proof_of_work_spec: args.prefetch_proof_of_work_spec,
      integration_hints: args.integration_hints,
    });
    if (!request) throw new Error("integration_name is required.");

    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const blockId = request.block_id ?? null;
    if (blockId) await assertBlockInWorkspace(supabase, workspaceId, blockId);

    const workspaceTitle = workspace.title || workspace.root_topic || "workspace";
    const evalDefinition = resolveEvalDefinition(request.eval_definition, workspace);

    let blocksQuery = supabase
      .from("blocks")
      .select("id, title, description, status, is_start")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });
    if (blockId) blocksQuery = blocksQuery.eq("id", blockId);

    const [{ data: blocks }, contextResult] = await Promise.all([
      blocksQuery,
      buildWorkspacePerformanceContext({ supabase, auth, workspaceId, blockId }).catch(() => null),
    ]);

    let proofOfWorkSpec = null;
    if (request.prefetch_proof_of_work_spec) {
      const proofOfWorkSchemaRequest = buildProofOfWorkSchemaRequestFromIntegration(
        evalDefinition,
        request.integration_name,
        request.partner_description,
        blockId
      );
      if (proofOfWorkSchemaRequest) {
        try {
          const proofOfWorkSpecResult = await generateWorkspaceProofOfWorkSpec({
            supabase,
            auth,
            workspaceId,
            workspaceTitle,
            request: proofOfWorkSchemaRequest,
            baseUrl: origin,
            blockId,
          });
          proofOfWorkSpec = proofOfWorkSpecResult.spec;
        } catch {
          // skill still generated without prefetch
        }
      }
    }

    const fileIds = contextResult?.fileIds || [];
    const skillResult = await callXaiResponsesWithFiles(
      buildIntegrationSkillPrompt(workspaceTitle, request.integration_name),
      fileIds,
      {
        instructions: buildIntegrationSkillInstructions(
          { ...request, eval_definition: evalDefinition, base_url: origin },
          {
            id: workspace.id,
            title: workspace.title,
            root_topic: workspace.root_topic,
            description: workspace.description,
            notes: workspace.notes,
            workspace_goal: workspace.workspace_goal ?? null,
            workspace_kind: workspace.workspace_kind,
          },
          blocks || [],
          blockId,
          proofOfWorkSpec,
          contextResult?.payload ?? null
        ),
        temperature: 0.45,
        maxOutputTokens: 8192,
        fetchTimeout: 120000,
      }
    );

    if (!skillResult.success || !skillResult.text) {
      throw new Error(skillResult.error || "Failed to generate integration skill.");
    }

    return await evidenceToolResult(
      {
        skill_md: withCanvasTapSimulationSkill(skillResult.text),
        skill_name: deriveSkillName(request.integration_name),
        suggested_share_path: deriveSuggestedSharePath(request.integration_name),
        workspace_summary: {
          id: workspace.id,
          title: workspace.title || workspace.root_topic || "Untitled",
          root_topic: workspace.root_topic,
          block_count: blocks?.length || 0,
        },
        proof_of_work_spec: proofOfWorkSpec,
        proof_of_work_spec_prefetched: !!proofOfWorkSpec,
        context_counts: contextResult?.payload.counts || null,
        file_ids: fileIds,
      },
      {
        endpoint: "generate_integration_skill",
        workspace_id: workspaceId,
        block_id: blockId,
        proof_of_work_artifacts: contextResult?.payload.counts.proof_of_work_artifacts,
      }
    );
  }

  if (name === "upload_proof_of_work") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    const sessionId = stringArg(args, "session_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    if (!sessionId) throw new Error("session_id is required.");
    try {
      const session = await ingestHeadlessProofForWorkspace({
        supabase,
        auth,
        workspaceId,
        sessionId,
        args,
      });
      return await evidenceToolResult(session, {
        endpoint: "upload_proof_of_work",
        workspace_id: workspaceId,
      });
    } catch (error) {
      if (error instanceof HeadlessSessionError) throw error;
      throw error;
    }
  }

  if (name === "list_flow_embeddings") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    await loadWorkspace(supabase, auth, workspaceId);
    const rows = await listFlowEmbeddings({
      workspaceId,
      flowKind: stringArg(args, "flow_kind"),
      flowId: stringArg(args, "flow_id"),
    });
    return await evidenceToolResult(
      { flow_embeddings: rows.map(presentFlowEmbedding) },
      { endpoint: "list_flow_embeddings", workspace_id: workspaceId },
    );
  }

  if (name === "get_flow_embedding") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    const embeddingId = stringArg(args, "embedding_id") || stringArg(args, "id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    if (!embeddingId) throw new Error("embedding_id is required.");
    await loadWorkspace(supabase, auth, workspaceId);
    const row = await getFlowEmbedding({ workspaceId, embeddingId });
    if (!row) throw new Error("Flow embedding not found.");
    return await evidenceToolResult(
      { flow_embedding: presentFlowEmbedding(row) },
      { endpoint: "get_flow_embedding", workspace_id: workspaceId },
    );
  }

  throw new Error(`Unknown tool: ${name}`);
}