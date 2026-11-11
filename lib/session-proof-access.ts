/**
 * Cookie / public Solve / Learn guest / TAP access for in-app PoW and embeddings.
 * Independent flows do not require a map workspace.
 */

import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { jsonError } from "@/lib/api-error-envelope";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSolveFlowById } from "@/lib/solve-flow-repository";
import { getCalibrationFlowById } from "@/lib/calibration-flow-repository";
import { getVerificationFlowById } from "@/lib/verification-flow-repository";
import { resolveSolveSessionAccess } from "@/lib/solve-session-auth";
import { resolveIleLinkSessionAccess } from "@/lib/learn-link-auth";
import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { entryQueryParamsFromBody, type EntryQueryParams } from "@/lib/guest-link-access";
import {
  loadBillingWorkspaceForProof,
  isProofWorkspaceId,
} from "@/lib/pow-api/billing-workspace";
import type { AuthContext } from "@/lib/pow-api/types";
import type { UploadWorkspaceProofOfWorkWorkspace } from "@/lib/pow-api/upload-workspace-proof-of-work";
import type { FlowKind } from "@/lib/flow-embedding";

export type SessionProofAccess = {
  supabase: SupabaseClient;
  auth: AuthContext;
  billingUserId: string;
  ownerUserId: string;
  workspace: UploadWorkspaceProofOfWorkWorkspace;
  workspaceId: string | null;
  sessionId: string | null;
  tapSessionId: string | null;
  flowKind: FlowKind | null;
  flowId: string | null;
  identity: string | null;
  ileLinkId?: string | null;
};

export type SessionProofAccessInput = {
  sessionId?: string | null;
  workspaceId?: string | null;
  solveToken?: string | null;
  ileToken?: string | null;
  privateToken?: string | null;
  tapSessionId?: string | null;
  entryQueryParams?: EntryQueryParams | null;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function authFromParticipant(input: {
  userId: string | null;
  guestUserId: string | null;
  organizationId: string | null;
  keyId: string;
}): AuthContext {
  return {
    user_id: input.guestUserId ? null : input.userId,
    guest_user_id: input.guestUserId,
    organization_id: input.organizationId,
    is_org_admin: false,
    key_id: input.keyId,
    scopes: ["workspaces:write"],
  };
}

function metaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function flowIdsFromSession(row: Record<string, unknown> | null | undefined): {
  flowKind: FlowKind | null;
  flowId: string | null;
  workspaceId: string | null;
  identity: string | null;
} {
  if (!row) {
    return { flowKind: null, flowId: null, workspaceId: null, identity: null };
  }
  const meta = metaRecord(row.metadata);
  const solveFlowId = text(row.solve_flow_id ?? row.solveFlowId ?? meta.solve_flow_id ?? meta.solveFlowId);
  const calibrateFlowId = text(
    row.calibrate_flow_id ?? row.calibrateFlowId ?? meta.calibrate_flow_id ?? meta.calibrateFlowId,
  );
  const verifyFlowId = text(
    row.verify_flow_id ?? row.verifyFlowId ?? meta.verify_flow_id ?? meta.verifyFlowId,
  );
  const workspaceId =
    text(row.workspace_id ?? meta.workspace_id ?? meta.workspaceId) || null;
  const identity = text(row.identity ?? meta.identity) || null;
  if (solveFlowId) return { flowKind: "solve", flowId: solveFlowId, workspaceId, identity };
  if (calibrateFlowId) return { flowKind: "calibrate", flowId: calibrateFlowId, workspaceId, identity };
  if (verifyFlowId) return { flowKind: "verify", flowId: verifyFlowId, workspaceId, identity };
  const kind = text(row.kind);
  if (kind === "learn" || kind === "calibrate" || kind === "verify" || kind === "solve") {
    return { flowKind: kind, flowId: null, workspaceId, identity };
  }
  return { flowKind: workspaceId ? "learn" : null, flowId: null, workspaceId, identity };
}

async function ownerUserIdForFlow(input: {
  flowKind: FlowKind | null;
  flowId: string | null;
}): Promise<string | null> {
  const flowId = text(input.flowId);
  if (!flowId) return null;
  if (input.flowKind === "solve") {
    const flow = await getSolveFlowById(flowId);
    return text(flow?.ownerUserId) || null;
  }
  if (input.flowKind === "calibrate") {
    const flow = await getCalibrationFlowById(flowId);
    return text(flow?.ownerUserId) || null;
  }
  if (input.flowKind === "verify") {
    const flow = await getVerificationFlowById(flowId);
    return text(flow?.ownerUserId) || null;
  }
  return null;
}

export function sessionProofAccessFromBody(body: Record<string, unknown>): SessionProofAccessInput {
  return {
    sessionId: text(body.sessionId ?? body.session_id) || null,
    workspaceId: text(body.workspaceId ?? body.workspace_id) || null,
    solveToken: text(body.solveToken ?? body.solve_token) || null,
    ileToken: text(body.ileToken ?? body.ile_token) || null,
    privateToken: text(body.privateToken ?? body.private_token) || null,
    tapSessionId: text(body.tapSessionId ?? body.tap_session_id) || null,
    entryQueryParams: entryQueryParamsFromBody(body),
  };
}

export async function requireSessionProofAccess(
  input: SessionProofAccessInput,
): Promise<SessionProofAccess | NextResponse> {
  const sessionId = text(input.sessionId) || null;
  const tapSessionId = text(input.tapSessionId) || null;
  const solveToken = text(input.solveToken);
  const ileToken = text(input.ileToken);
  const privateToken = text(input.privateToken);
  const requestedWorkspaceId = text(input.workspaceId);
  const entryQueryParams = input.entryQueryParams ?? {};

  if (solveToken) {
    if (!sessionId) return jsonError(400, "sessionId is required");
    const access = await resolveSolveSessionAccess(solveToken, sessionId);
    if ("error" in access) return jsonError(access.status, access.error);
    const workspaceId = isProofWorkspaceId(access.workspaceId) ? access.workspaceId : null;
    const ownerUserId = text(access.ownerUserId);
    const billingUserId = text(access.runOwnerUserId) || ownerUserId;
    if (!billingUserId) return jsonError(500, "Workspace owner is missing");
    const workspace = await loadBillingWorkspaceForProof(access.supabase, {
      workspaceId,
      ownerUserId,
      organizationId: null,
    });
    return {
      supabase: access.supabase,
      auth: authFromParticipant({
        userId: billingUserId,
        guestUserId: null,
        organizationId: workspace.organization_id,
        keyId: "solve-session",
      }),
      billingUserId,
      ownerUserId: ownerUserId || billingUserId,
      workspace: { ...workspace, user_id: workspace.user_id || ownerUserId || billingUserId },
      workspaceId,
      sessionId,
      tapSessionId: null,
      flowKind: "solve",
      flowId: access.flow.id,
      identity: access.identity,
    };
  }

  if (ileToken) {
    if (!sessionId) return jsonError(400, "sessionId is required");
    const ile = await resolveIleLinkSessionAccess(ileToken, sessionId, entryQueryParams);
    if ("error" in ile) return jsonError(ile.status, ile.error);
    const workspaceId = isProofWorkspaceId(ile.workspaceId) ? ile.workspaceId : null;
    const participantUserId = ile.assignedUserId;
    const participantGuestUserId = ile.assignedUserId ? null : ile.guestUserId;
    if (!participantUserId && !participantGuestUserId) {
      return jsonError(500, "Learn guest participant is not provisioned", "guest_missing");
    }
    const ownerUserId = text(ile.ownerUserId);
    const billingUserId = ownerUserId || participantUserId;
    if (!billingUserId) return jsonError(500, "Workspace owner is missing");
    const workspace = await loadBillingWorkspaceForProof(ile.supabase, {
      workspaceId,
      ownerUserId,
      organizationId: null,
    });
    return {
      supabase: ile.supabase,
      auth: authFromParticipant({
        userId: participantUserId,
        guestUserId: participantGuestUserId,
        organizationId: workspace.organization_id,
        keyId: "ile-link",
      }),
      billingUserId,
      ownerUserId: ownerUserId || billingUserId,
      workspace: { ...workspace, user_id: workspace.user_id || ownerUserId },
      workspaceId,
      sessionId,
      tapSessionId: null,
      flowKind: "learn",
      flowId: null,
      identity: null,
      ileLinkId: ile.linkId,
    };
  }

  if (privateToken || tapSessionId) {
    const access = await resolveTapSessionAccess({
      privateToken: privateToken || undefined,
      workspaceId: requestedWorkspaceId || undefined,
      tapSessionId: tapSessionId || undefined,
      entryQueryParams,
    });
    if ("error" in access) return jsonError(access.status, access.error);
    const workspaceId = isProofWorkspaceId(access.workspaceId) ? access.workspaceId : null;
    const ownerUserId = text(access.workspaceOwnerUserId);
    const billingUserId = ownerUserId || text(access.userId);
    if (!billingUserId) return jsonError(500, "Workspace owner is missing");
    const workspace = await loadBillingWorkspaceForProof(access.supabase, {
      workspaceId,
      ownerUserId,
      organizationId: access.organizationId,
    });
    const sessionRow = access.existingSession as Record<string, unknown> | null;
    const flows = flowIdsFromSession(sessionRow);
    const flowKind: FlowKind =
      access.sessionTable.includes("calibrate") ? "calibrate" : flows.flowKind === "calibrate" ? "calibrate" : "verify";
    return {
      supabase: access.supabase,
      auth: authFromParticipant({
        userId: access.userId,
        guestUserId: access.guestUserId,
        organizationId: access.organizationId,
        keyId: "tap-session",
      }),
      billingUserId,
      ownerUserId: ownerUserId || billingUserId,
      workspace: { ...workspace, user_id: workspace.user_id || ownerUserId },
      workspaceId,
      sessionId: text(access.focusSessionId) || sessionId,
      tapSessionId: text(access.tapSessionId) || tapSessionId,
      flowKind,
      flowId: flows.flowId,
      identity: flows.identity,
    };
  }

  if (!sessionId) return jsonError(400, "sessionId is required");

  const cookie = await createClient();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return jsonError(401, "Not authenticated");

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("sessions")
    .select(
      "id, user_id, kind, workspace_id, solve_flow_id, calibrate_flow_id, verify_flow_id, identity, metadata, organization_id",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return jsonError(404, "Session not found");

  const row = session as Record<string, unknown>;
  const flows = flowIdsFromSession(row);
  const workspaceId =
    (isProofWorkspaceId(requestedWorkspaceId) ? requestedWorkspaceId : null) || flows.workspaceId;
  const workspace = await loadBillingWorkspaceForProof(admin, {
    workspaceId,
    ownerUserId: text(row.user_id) || user.id,
    organizationId: text(row.organization_id) || null,
  });
  const isSessionParticipant = text(row.user_id) === user.id;
  const isWorkspaceOwner = text(workspace.user_id) === user.id;
  const flowOwnerUserId = await ownerUserIdForFlow(flows);
  const isFlowOwner = flowOwnerUserId === user.id;
  if (!isSessionParticipant && !isWorkspaceOwner && !isFlowOwner) {
    return jsonError(403, "Forbidden", "forbidden");
  }

  const ownerUserId = flowOwnerUserId || text(workspace.user_id) || user.id;
  const { data: profile } = await cookie
    .from("profiles")
    .select("organization_id, is_org_admin, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase: admin,
    auth: {
      user_id: user.id,
      guest_user_id: null,
      organization_id:
        (profile?.organization_id ? String(profile.organization_id) : null) ||
        workspace.organization_id,
      is_org_admin: profile?.is_org_admin === true || profile?.is_admin === true,
      key_id: "ui-session",
      scopes: ["workspaces:read", "workspaces:write"],
    },
    billingUserId: user.id,
    ownerUserId,
    workspace: { ...workspace, user_id: workspace.user_id || ownerUserId },
    workspaceId,
    sessionId,
    tapSessionId: null,
    flowKind: flows.flowKind,
    flowId: flows.flowId,
    identity: flows.identity,
  };
}
