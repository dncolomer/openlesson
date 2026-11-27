import {
  createAgentProtocol,
  deleteAgentProtocol,
  generateAgentFlowUnsysSeed,
  getAgentProtocol,
  getAgentProtocolUrl,
  listAgentProtocols,
  updateAgentProtocol,
  uploadAgentFlowFile,
} from "../agent-flow-management";
import { loadKnowledgeRegionCandidate } from "@/lib/knowledge-region-candidate";
import { loadKnowledgeRegionUncertaintyModel } from "@/lib/knowledge-region-unsys";
import {
  createAgentKnowledgeRegion,
  deleteAgentKnowledgeRegion,
  getAgentKnowledgeRegion,
  getAgentKnowledgeRegionJob,
  getAgentKnowledgeRegionRun,
  listAgentKnowledgeRegionOptions,
  listAgentKnowledgeRegions,
  simulateAgentKnowledgeRegion,
  updateAgentKnowledgeRegion,
} from "../agent-knowledge-region-management";
import { presentPublicFlowArtifact } from "@/lib/flow-artifacts";
import { rejectedProtocolKind } from "@/lib/product-flow";
import { requireToolOrganizationId } from "@/lib/organization/request-organization";
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
  const organizationId = await requireToolOrganizationId({ auth, args });

  if (name === "list_protocols") {
    requireScope(auth.scopes, "workspaces:read");
    assertNoRetiredKind(args);
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("No user available to list protocols");
    const protocols = await listAgentProtocols({
      ownerUserId,
      organizationId,
    });
    return await evidenceToolResult({ protocols }, { endpoint: "list_protocols" });
  }

  if (name === "create_protocol") {
    requireScope(auth.scopes, "workspaces:write");
    assertNoRetiredKind(args);
    const protocol = await createAgentProtocol(auth, undefined, args, organizationId);
    return await evidenceToolResult({ protocol }, { endpoint: "create_protocol" });
  }

  if (name === "upload_protocol_file") {
    requireScope(auth.scopes, "workspaces:write");
    const artifact = await uploadAgentFlowFile(auth, args);
    return await evidenceToolResult(
      {
        artifact: presentPublicFlowArtifact(artifact),
        file_id: artifact.xaiFileId,
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
    const protocol = await getAgentProtocol(
      undefined,
      protocolId,
      String(auth.user_id || ""),
      organizationId,
    );
    if (!protocol) throw new Error("Protocol not found.");
    return await evidenceToolResult({ protocol }, { endpoint: "get_protocol" });
  }

  if (name === "get_protocol_url") {
    requireScope(auth.scopes, "workspaces:read");
    const protocolId = stringArg(args, "protocol_id");
    if (!protocolId) throw new Error("protocol_id is required.");
    const launch = await getAgentProtocolUrl(
      undefined,
      protocolId,
      String(auth.user_id || ""),
      organizationId,
      ctx.origin,
      args,
    );
    if (!launch) throw new Error("Protocol not found.");
    return await evidenceToolResult(launch, { endpoint: "get_protocol_url" });
  }

  if (name === "update_protocol") {
    requireScope(auth.scopes, "workspaces:write");
    assertNoRetiredKind(args);
    const protocolId = stringArg(args, "protocol_id");
    if (!protocolId) throw new Error("protocol_id is required.");
    const protocol = await updateAgentProtocol(
      auth,
      undefined,
      protocolId,
      args,
      organizationId,
    );
    return await evidenceToolResult({ protocol }, { endpoint: "update_protocol" });
  }

  if (name === "delete_protocol") {
    requireScope(auth.scopes, "workspaces:write");
    const protocolId = stringArg(args, "protocol_id");
    if (!protocolId) throw new Error("protocol_id is required.");
    const deleted = await deleteAgentProtocol(auth, protocolId, organizationId);
    return await evidenceToolResult(deleted, { endpoint: "delete_protocol" });
  }

  if (name === "list_knowledge_regions") {
    requireScope(auth.scopes, "workspaces:read");
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("Not authenticated");
    const knowledge_regions = await listAgentKnowledgeRegions(ownerUserId, organizationId);
    return await evidenceToolResult({ knowledge_regions }, { endpoint: "list_knowledge_regions" });
  }

  if (name === "get_knowledge_region_options") {
    requireScope(auth.scopes, "workspaces:read");
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("Not authenticated");
    const options = await listAgentKnowledgeRegionOptions(ownerUserId, organizationId);
    return await evidenceToolResult(options, { endpoint: "get_knowledge_region_options" });
  }

  if (name === "create_knowledge_region") {
    requireScope(auth.scopes, "workspaces:write");
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("Not authenticated");
    const created = await createAgentKnowledgeRegion(ownerUserId, args, organizationId);
    const payload = created.kind === "job" ? created.job : created;
    return await evidenceToolResult(payload, { endpoint: "create_knowledge_region" });
  }

  if (name === "get_knowledge_region") {
    requireScope(auth.scopes, "workspaces:read");
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("Not authenticated");
    const knowledgeRegionId = stringArg(args, "knowledge_region_id");
    if (!knowledgeRegionId) throw new Error("knowledge_region_id is required.");
    const loaded = await getAgentKnowledgeRegion(
      ownerUserId,
      knowledgeRegionId,
      organizationId,
    );
    if (!loaded) throw new Error("Knowledge region not found.");
    return await evidenceToolResult(loaded, { endpoint: "get_knowledge_region" });
  }

  if (name === "update_knowledge_region") {
    requireScope(auth.scopes, "workspaces:write");
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("Not authenticated");
    const knowledgeRegionId = stringArg(args, "knowledge_region_id");
    if (!knowledgeRegionId) throw new Error("knowledge_region_id is required.");
    const knowledge_region = await updateAgentKnowledgeRegion(
      ownerUserId,
      knowledgeRegionId,
      args,
      organizationId,
    );
    return await evidenceToolResult({ knowledge_region }, { endpoint: "update_knowledge_region" });
  }

  if (name === "delete_knowledge_region") {
    requireScope(auth.scopes, "workspaces:write");
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("Not authenticated");
    const knowledgeRegionId = stringArg(args, "knowledge_region_id");
    if (!knowledgeRegionId) throw new Error("knowledge_region_id is required.");
    const deleted = await deleteAgentKnowledgeRegion(
      ownerUserId,
      knowledgeRegionId,
      organizationId,
    );
    return await evidenceToolResult(deleted, { endpoint: "delete_knowledge_region" });
  }

  if (name === "simulate_knowledge_region") {
    requireScope(auth.scopes, "workspaces:write");
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("Not authenticated");
    const knowledgeRegionId = stringArg(args, "knowledge_region_id");
    if (!knowledgeRegionId) throw new Error("knowledge_region_id is required.");
    const created = await simulateAgentKnowledgeRegion(
      ownerUserId,
      knowledgeRegionId,
      args,
      organizationId,
    );
    const payload = created.kind === "job" ? created.job : created;
    return await evidenceToolResult(payload, { endpoint: "simulate_knowledge_region" });
  }

  if (name === "get_knowledge_region_job") {
    requireScope(auth.scopes, "workspaces:read");
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("Not authenticated");
    const jobId = stringArg(args, "job_id");
    if (!jobId) throw new Error("job_id is required.");
    const job = await getAgentKnowledgeRegionJob(ownerUserId, jobId, organizationId);
    if (!job) throw new Error("Job not found.");
    return await evidenceToolResult(job, { endpoint: "get_knowledge_region_job" });
  }

  if (name === "get_knowledge_region_run") {
    requireScope(auth.scopes, "workspaces:read");
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("Not authenticated");
    const knowledgeRegionId = stringArg(args, "knowledge_region_id");
    const runId = stringArg(args, "run_id");
    if (!knowledgeRegionId || !runId) {
      throw new Error("knowledge_region_id and run_id are required.");
    }
    const payload = await getAgentKnowledgeRegionRun({
      ownerUserId,
      knowledgeRegionId,
      runId,
      organizationId,
    });
    return await evidenceToolResult(payload, { endpoint: "get_knowledge_region_run" });
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
      organizationId,
    });
    if (!loaded.ok) throw new Error(loaded.message);
    return await evidenceToolResult(loaded.payload, { endpoint: "get_knowledge_region_candidate" });
  }

  if (name === "get_knowledge_region_uncertainty_model") {
    requireScope(auth.scopes, "workspaces:read");
    const ownerUserId = String(auth.user_id || "").trim();
    if (!ownerUserId) throw new Error("Not authenticated");
    const knowledgeRegionId = stringArg(args, "knowledge_region_id");
    const candidateId = stringArg(args, "candidate_id");
    if (!knowledgeRegionId || !candidateId) {
      throw new Error("knowledge_region_id and candidate_id are required.");
    }
    const loaded = await loadKnowledgeRegionUncertaintyModel({
      ownerUserId,
      knowledgeRegionId,
      candidateId,
      runId: stringArg(args, "run_id") || stringArg(args, "runId"),
      organizationId,
    });
    if (!loaded.ok) throw new Error(loaded.message);
    return await evidenceToolResult(loaded.payload, {
      endpoint: "get_knowledge_region_uncertainty_model",
    });
  }

  throw new Error(`Unknown tool: ${name}`);
}
