import type { SupabaseClient } from "@supabase/supabase-js";
import { parseProofOfWorkSchemaRequest } from "../proof-of-work-schema";
import {
  generateOpaqueWorkspaceProofOfWorkSpec,
  generateWorkspaceProofOfWorkSpec,
  parseOpaqueSchemaRequest,
} from "../proof-of-work-integration";
import { CreateTapLinkError, createWorkspaceTapLink } from "../create-tap-link";
import {
  CreateTapbenchLinkError,
  createWorkspaceTapbenchLink,
  listWorkspaceTapbenchLinks,
} from "../create-tapbench-link";
import { rejectProgrammaticWorkspaceCreate } from "../workspace-create-ui-only";
import { runVerticalScore } from "../run-vertical-score";
import type { ScoreVertical } from "../performance-report";
import {
  buildProofOfWorkSchemaRequestFromIntegration,
  resolveEvalDefinition,
} from "../proof-of-work-integration";
import {
  buildIntegrationSkillInstructions,
  buildIntegrationSkillPrompt,
  deriveSkillName,
  deriveSuggestedSharePath,
  parseIntegrationSkillRequest,
} from "../integration-skill";
import { buildWorkspacePerformanceContext } from "../performance-context";
import type { ApiKeyScope, AuthContext } from "../types";
import { hasScope } from "../auth";
import { canAccessAgentWorkspace } from "../workspace-access";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";
import {
  buildContinuousEvaluationMcpPolicy,
  buildIntegrationSurfaces,
  buildUncertainSystemsScopeForWorkspace,
  UNCERTAIN_SYSTEMS_SCOPE,
  recommendIntegrationActions,
} from "../integration-discovery";
import {
  buildContinuousEvaluationPolicy,
  buildProofOfWorkSchemaApiPath,
  buildIntegrationSkillApiPath,
  buildPerformanceApiPath,
  resolveProofOfWorkSchemaInterruption,
} from "../proof-of-work-integration";
import {
  type InterruptionContext,
  withProofOfWorkApiResponse,
} from "../predictive-interruption";
import {
  getAgentLearningProgress,
  listAgentWorkspaces,
} from "../agent-workspace-ops";
import {
  getUploadProofOfWorkMeta,
  uploadWorkspaceProofOfWork,
} from "../upload-workspace-proof-of-work";
import { countWorkspaceProofOfWorkForPlan } from "../workspace-proof-of-work";
import {
  bufferSubjectId,
  getStashBufferSize,
  ingestStashUnit,
  stashBufferedProofOfWork,
  submitBufferedProofOfWork,
} from "../stash-api";
import {
  handleCreateCustomKnowledgeRegion,
  handleEvalCustomKnowledgeRegion,
  handleGetKnowledgeConfig,
  handleGetKnowledgeConfigTrajectory,
  handleGetWorldModel,
  handleKnowledgeDistance,
  handleListCustomKnowledgeRegions,
  handleListSnapshotHistory,
} from "./snapshot-handlers";
import {
  MCP_EVIDENCE_TOOLS,
  MCP_PROOF_OF_WORK_PROTOCOL_VERSION,
  MCP_PROOF_OF_WORK_SERVER_INSTRUCTIONS,
  MCP_PROOF_OF_WORK_SERVER_NAME,
  MCP_PROOF_OF_WORK_SERVER_VERSION,
  McpProofOfWorkToolContext,
  WorkspaceRow,
  assertBlockInWorkspace,
  evidenceToolResult,
  loadWorkspace,
  requireScope,
  stringArg,
  tapLinkIdArg,
  textToolResult,
  withProgressGuidance
} from "./helpers";

export async function callMcpProofOfWorkTool(
  name: string,
  args: Record<string, unknown>,
  ctx: McpProofOfWorkToolContext
) {
  const { auth, supabase, origin } = ctx;
  if (name === "list_workspaces") {
    requireScope(auth.scopes, "workspaces:read");
    const payload = await listAgentWorkspaces(supabase, auth, {
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
    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    return await evidenceToolResult(
      { workspace },
      { endpoint: "get_workspace", workspace_id: workspaceId }
    );
  }

  if (name === "get_learning_progress") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const progress = await getAgentLearningProgress(supabase, auth, workspaceId, origin);
    const { counts, workspace_row: _ws, ...payload } = progress;
    return await evidenceToolResult(payload, {
      endpoint: "get_learning_progress",
      workspace_id: workspaceId,
      proof_of_work_artifacts: counts.proof_of_work_artifacts,
    });
  }

  if (name === "create_workspace") {
    // Tool removed from catalog; hard-fail if a client still calls it.
    rejectProgrammaticWorkspaceCreate();
  }

  if (name === "list_blocks") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    await loadWorkspace(supabase, auth, workspaceId);

    const { data: blocks, error } = await supabase
      .from("blocks")
      .select("id, title, description, is_start, next_block_ids, status, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return await evidenceToolResult(
      { blocks: blocks || [] },
      { endpoint: "list_blocks", workspace_id: workspaceId }
    );
  }

  if (name === "generate_proof_of_work_schema") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");

    const opaqueRequest = parseOpaqueSchemaRequest(args as Record<string, unknown>);
    const semanticRequest = opaqueRequest
      ? null
      : parseProofOfWorkSchemaRequest({
          definition: args.definition,
          block_id: args.block_id,
          integration_hints: args.integration_hints,
        });
    if (!opaqueRequest && !semanticRequest) {
      throw new Error(
        args.evaluation_mode === "opaque"
          ? "definition_ref and contract.event_verbs are required for opaque schema generation."
          : "definition is required."
      );
    }

    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const blockId = (opaqueRequest?.block_id ?? semanticRequest?.block_id) || null;
    if (blockId) await assertBlockInWorkspace(supabase, workspaceId, blockId);

    const workspaceTitle = workspace.title || workspace.root_topic || "workspace";

    if (opaqueRequest) {
      const { spec, contextCounts, fileIds, privacy } = await generateOpaqueWorkspaceProofOfWorkSpec({
        supabase,
        auth,
        workspaceId,
        request: opaqueRequest,
        baseUrl: origin,
        blockId,
      });

      const llmInterruption = resolveProofOfWorkSchemaInterruption(spec, workspaceId);

      return await evidenceToolResult(
        {
          ...spec,
          definition_ref: opaqueRequest.definition_ref,
          evaluation_mode: "opaque",
          privacy,
          workspace_summary: {
            id: workspace.id,
            title: workspace.title,
            root_topic: workspace.root_topic,
          },
          context_counts: contextCounts,
          file_ids: fileIds,
        },
        {
          endpoint: "generate_proof_of_work_schema",
          workspace_id: workspaceId,
          block_id: blockId,
          proof_of_work_artifacts: contextCounts?.proof_of_work_artifacts,
          llm_interruption: llmInterruption,
        }
      );
    }

    const { spec, contextCounts, fileIds } = await generateWorkspaceProofOfWorkSpec({
      supabase,
      auth,
      workspaceId,
      workspaceTitle,
      request: semanticRequest!,
      baseUrl: origin,
      blockId,
    });

    const llmInterruption = resolveProofOfWorkSchemaInterruption(spec, workspaceId);

    return await evidenceToolResult(
      {
        ...spec,
        definition: semanticRequest!.definition,
        evaluation_mode: "semantic",
        workspace_summary: {
          id: workspace.id,
          title: workspace.title,
          root_topic: workspace.root_topic,
        },
        context_counts: contextCounts,
        file_ids: fileIds,
      },
      {
        endpoint: "generate_proof_of_work_schema",
        workspace_id: workspaceId,
        block_id: blockId,
        proof_of_work_artifacts: contextCounts?.proof_of_work_artifacts,
        llm_interruption: llmInterruption,
      }
    );
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
        skill_md: skillResult.text,
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
    if (!workspaceId) throw new Error("workspace_id is required.");

    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const blockId = typeof args.block_id === "string" ? args.block_id : null;

    const row = await uploadWorkspaceProofOfWork(
      supabase,
      auth,
      {
        id: workspace.id,
        user_id: workspace.user_id,
        organization_id: workspace.organization_id,
        evaluation_mode: workspace.evaluation_mode,
        protocol_config: workspace.protocol_config,
        external_refs: workspace.external_refs,
        title: workspace.title,
        root_topic: workspace.root_topic,
        workspace_goal: workspace.workspace_goal,
      },
      {
        workspaceId,
        type: typeof args.type === "string" ? args.type : "",
        mime_type: typeof args.mime_type === "string" ? args.mime_type : "",
        data: typeof args.data === "string" ? args.data : "",
        block_id: blockId,
        session_id: typeof args.session_id === "string" ? args.session_id : null,
        file_name: typeof args.file_name === "string" ? args.file_name : undefined,
        timestamp_ms: typeof args.timestamp_ms === "number" ? args.timestamp_ms : undefined,
        tool_name: typeof args.tool_name === "string" ? args.tool_name : undefined,
        tool_action: typeof args.tool_action === "string" ? args.tool_action : undefined,
        metadata:
          args.metadata && typeof args.metadata === "object" && !Array.isArray(args.metadata)
            ? (args.metadata as Record<string, unknown>)
            : undefined,
        require_existing_session: true,
      },
    );

    const meta = getUploadProofOfWorkMeta(row);
    const proofOfWorkCount = await countWorkspaceProofOfWorkForPlan(supabase, workspaceId);

    return await evidenceToolResult(
      {
        proof_of_work: row,
        evaluation_mode: meta.evaluation_mode,
        privacy: meta.privacy,
        plaintext_lint: meta.plaintext_lint,
      },
      {
        endpoint: "upload_proof_of_work",
        workspace_id: workspaceId,
        block_id: blockId,
        proof_of_work_artifacts: proofOfWorkCount ?? 1,
        tool_name: typeof row.tool_name === "string" ? row.tool_name : null,
      }
    );
  }

  // Sole public score tool: LWM Snapshot.
  if (name === "lwm_snapshot") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");

    const vertical = "verification" as ScoreVertical;
    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const stylePrompt = typeof args.style_prompt === "string" ? args.style_prompt.trim() : "";
    const blockId = typeof args.block_id === "string" ? args.block_id : null;
    if (blockId) await assertBlockInWorkspace(supabase, workspaceId, blockId);

    const scored = await runVerticalScore({
      supabase,
      auth,
      workspaceId,
      vertical,
      blockId,
      stylePrompt,
      workspaceRow: workspace,
      goalSelectionBody: args as Record<string, unknown>,
    });

    return await evidenceToolResult(
      withProgressGuidance(
        {
          mode: "score",
          vertical,
          strategy: "lwm_snapshot",
          label: "LWM Snapshot",
          evaluation_mode: scored.evaluation_mode,
          privacy: scored.privacy,
          workspace_goal: scored.workspace_goal,
          workspace_goal_source: scored.workspace_goal_source,
          evaluated_goals: scored.evaluated_goals,
          goals_fingerprint: scored.goals_fingerprint,
          report: scored.report,
          protocol_report: scored.protocol_report,
          proof_of_work_summary: scored.proof_of_work_summary,
          file_ids: scored.file_ids,
        },
        {
          origin,
          workspaceId,
          counts: scored.proof_of_work_summary ?? {
            blocks: 0,
            proof_of_work_artifacts: 0,
            linked_sessions: 0,
            workspace_files: 0,
          },
          workspaceGoal: scored.workspace_goal,
          workspaceTitle: workspace.title || workspace.root_topic || "workspace",
          workspace_kind: workspace.workspace_kind,
        }
      ),
      {
        endpoint: "lwm_snapshot",
        workspace_id: workspaceId,
        block_id: blockId,
        mode: "score",
        report: scored.report,
        proof_of_work_artifacts: scored.proof_of_work_summary?.proof_of_work_artifacts,
      }
    );
  }

  if (name === "list_tap_links") {
    requireScope(auth.scopes, "tap:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");

    let query = supabase
      .from("workspace_tap_sessions")
      .select(
        "id, workspace_id, block_id, status, requested_duration_seconds, duration_seconds, mode, overall_score, created_at, started_at, completed_at, participant_type, post_session, redirect_url, guest_user_id, assigned_user_id"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (auth.guest_user_id) {
      query = query.eq("guest_user_id", auth.guest_user_id);
    } else if (!auth.is_org_admin && auth.user_id) {
      query = query.or(`user_id.eq.${auth.user_id},assigned_user_id.eq.${auth.user_id}`);
    }

    const { data: links, error } = await query;
    if (error) throw new Error(error.message);
    return await evidenceToolResult(
      { tap_links: links || [] },
      { endpoint: "list_tap_links", workspace_id: workspaceId }
    );
  }

  if (name === "create_tap_link") {
    requireScope(auth.scopes, "tap:write");
    const workspaceId = stringArg(args, "workspace_id");
    const blockId = stringArg(args, "block_id") || null;
    if (!workspaceId) throw new Error("workspace_id is required.");

    try {
      const appBase = process.env.NEXT_PUBLIC_APP_URL || origin;
      const tapLink = await createWorkspaceTapLink({
        supabase,
        auth,
        workspaceId,
        blockId,
        body: args,
        baseUrl: appBase,
      });

      return await evidenceToolResult(
        {
          tap_link: tapLink,
          private_url: tapLink.private_url,
        },
        {
          endpoint: "create_tap_link",
          workspace_id: workspaceId,
          block_id: blockId,
          tap_minutes: Math.round(tapLink.requested_duration_seconds / 60),
        }
      );
    } catch (error) {
      if (error instanceof CreateTapLinkError) throw new Error(error.message);
      throw error;
    }
  }

  if (name === "list_tapbench_links") {
    requireScope(auth.scopes, "tap:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    try {
      const appBase = process.env.NEXT_PUBLIC_APP_URL || origin;
      const listed = await listWorkspaceTapbenchLinks({
        supabase,
        auth,
        workspaceId,
        baseUrl: appBase,
      });
      return await evidenceToolResult(listed, {
        endpoint: "list_tapbench_links",
        workspace_id: workspaceId,
      });
    } catch (error) {
      if (error instanceof CreateTapbenchLinkError) throw new Error(error.message);
      throw error;
    }
  }

  if (name === "create_tapbench_link") {
    requireScope(auth.scopes, "tap:write");
    const workspaceId = stringArg(args, "workspace_id");
    const blockId = stringArg(args, "block_id") || null;
    if (!workspaceId) throw new Error("workspace_id is required.");

    try {
      const appBase = process.env.NEXT_PUBLIC_APP_URL || origin;
      const tapbenchLink = await createWorkspaceTapbenchLink({
        supabase,
        auth,
        workspaceId,
        blockId,
        body: args,
        baseUrl: appBase,
      });
      return await evidenceToolResult(
        {
          workspace_id: workspaceId,
          tapbench_link: tapbenchLink,
          session_token: tapbenchLink.session_token,
          url: tapbenchLink.url,
          exercise_source: tapbenchLink.exercise_source,
        },
        {
          endpoint: "create_tapbench_link",
          workspace_id: workspaceId,
          block_id: blockId,
        },
      );
    } catch (error) {
      if (error instanceof CreateTapbenchLinkError) throw new Error(error.message);
      throw error;
    }
  }

  if (name === "get_world_model") {
    return handleGetWorldModel(args, ctx);
  }

  if (name === "get_knowledge_config") {
    return handleGetKnowledgeConfig(args, ctx);
  }

  if (name === "get_knowledge_config_trajectory") {
    return handleGetKnowledgeConfigTrajectory(args, ctx);
  }

  if (name === "knowledge_distance") {
    return handleKnowledgeDistance(args, ctx);
  }

  if (name === "list_snapshot_history") {
    return handleListSnapshotHistory(args, ctx);
  }

  if (name === "list_custom_knowledge_regions") {
    return handleListCustomKnowledgeRegions(args, ctx);
  }

  if (name === "create_custom_knowledge_region") {
    return handleCreateCustomKnowledgeRegion(args, ctx);
  }

  if (name === "eval_custom_knowledge_region") {
    return handleEvalCustomKnowledgeRegion(args, ctx);
  }

  if (name === "buffer_proof_of_work") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    await loadWorkspace(supabase, auth, workspaceId);
    const subjectId = bufferSubjectId(auth);
    const ingested = ingestStashUnit(workspaceId, subjectId, args);
    if (!ingested.ok) throw new Error(ingested.message);
    const buffered = getStashBufferSize(workspaceId, subjectId);
    return await evidenceToolResult(
      {
        buffered: true,
        unit: {
          id: ingested.unit.id,
          type: ingested.unit.type,
          type_raw: ingested.unit.type_raw,
          mime_type: ingested.unit.mime_type,
          file_name: ingested.unit.file_name ?? null,
          block_id: ingested.unit.block_id,
          session_id: ingested.unit.session_id,
          tool_name: ingested.unit.tool_name,
          tool_action: ingested.unit.tool_action,
          timestamp_ms: ingested.unit.timestamp_ms,
          buffered_at: ingested.unit.buffered_at,
        },
        buffer_count: buffered,
        workspace_id: workspaceId,
        user_id: auth.user_id,
        guest_user_id: auth.guest_user_id,
        next: {
          stash: `POST /api/v3/stash/workspaces/${workspaceId}/stash`,
          submit: `POST /api/v3/stash/workspaces/${workspaceId}/submit`,
        },
        note: "Proof of work is held temporarily until Stash (System 1) or Submit (System 2).",
      },
      { endpoint: "buffer_proof_of_work", workspace_id: workspaceId },
    );
  }

  if (name === "stash_proof_of_work" || name === "submit_stashed_proof_of_work") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const subjectId = bufferSubjectId(auth);
    const flush =
      name === "stash_proof_of_work"
        ? await stashBufferedProofOfWork({
            workspaceId,
            subjectId,
            auth,
            workspace: {
              id: workspace.id,
              user_id: workspace.user_id || auth.user_id || "",
              organization_id: workspace.organization_id ?? auth.organization_id,
            },
            supabase,
          })
        : await submitBufferedProofOfWork({
            workspaceId,
            subjectId,
            auth,
            workspace: {
              id: workspace.id,
              user_id: workspace.user_id || auth.user_id || "",
              organization_id: workspace.organization_id ?? auth.organization_id,
            },
            supabase,
          });
    if (!flush.ok) throw new Error(flush.error);
    const decision = name === "stash_proof_of_work" ? "stash" : "submit";
    return await evidenceToolResult(
      {
        decision,
        system: flush.system,
        system_label: decision === "stash" ? "System 1" : "System 2",
        flushed: flush.flushed,
        empty: flush.empty,
        proof_of_work: flush.proof_of_work,
        buffer_remaining: flush.buffer_remaining,
        workspace_id: workspaceId,
        user_id: auth.user_id,
        guest_user_id: auth.guest_user_id,
        note: flush.empty
          ? `No buffered proof of work — nothing to ${decision}.`
          : `Buffered units flushed to PoW API as ${decision === "stash" ? "System 1 (stash)" : "System 2 (submit)"}; buffer reset.`,
      },
      { endpoint: name, workspace_id: workspaceId },
    );
  }

  throw new Error(`Unknown tool: ${name}`);
}