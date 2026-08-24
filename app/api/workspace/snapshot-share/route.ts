import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody } from "@/lib/api/require-auth";
import { getEvalRunHistoryById } from "@/lib/pow-api/eval-run-history-store";
import {
  createSupabaseSnapshotShareBackend,
  generateSnapshotShare,
  lookupSnapshotShare,
} from "@/lib/pow-api/snapshot-share";
import { requireProductWorkspaceEvalAuth } from "@/lib/product-workspace-auth";

export const runtime = "nodejs";

function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

function parseEvalRunHistoryId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function authorizeSnapshotShare(
  workspaceId: string,
  evalRunHistoryId: string,
  ayclToken?: string | null,
) {
  if (!workspaceId) {
    return { ok: false as const, response: jsonError(400, "workspaceId is required") };
  }
  if (!evalRunHistoryId) {
    return {
      ok: false as const,
      response: jsonError(400, "evalRunHistoryId is required"),
    };
  }

  const auth = await requireProductWorkspaceEvalAuth(workspaceId, ayclToken);
  if (!auth.ok) return auth;

  const row = await getEvalRunHistoryById(auth.supabase, evalRunHistoryId);
  if (!row || row.workspace_id !== workspaceId) {
    return { ok: false as const, response: jsonError(404, "Snapshot not found") };
  }

  if (!auth.isOwner) {
    const ownUser = row.subject_user_id === auth.persistUserId;
    if (!ownUser) {
      return { ok: false as const, response: jsonError(403, "Forbidden") };
    }
  }

  return { ok: true as const, auth, row };
}

/**
 * GET /api/workspace/snapshot-share?workspaceId=&evalRunHistoryId=
 * Return an existing public URL for a snapshot (owner/eval member). Does not mint.
 */
export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId")?.trim() || "";
  const evalRunHistoryId =
    req.nextUrl.searchParams.get("evalRunHistoryId")?.trim() ||
    req.nextUrl.searchParams.get("eval_run_history_id")?.trim() ||
    "";
  const ayclToken = req.nextUrl.searchParams.get("ayclToken");

  const access = await authorizeSnapshotShare(
    workspaceId,
    evalRunHistoryId,
    ayclToken,
  );
  if (!access.ok) return access.response;

  const backend = createSupabaseSnapshotShareBackend(access.auth.supabase);
  const existing = await backend.getShareBySnapshotId(evalRunHistoryId);
  if (!existing) {
    return NextResponse.json({ share: null, url: null, token: null });
  }
  const landing = await lookupSnapshotShare(backend, existing.token);
  return NextResponse.json({
    share: existing,
    token: existing.token,
    url: `${baseUrl(req).replace(/\/$/, "")}/snapshot/${encodeURIComponent(existing.token)}`,
    landing,
  });
}

/**
 * POST /api/workspace/snapshot-share
 * Mint (or reuse) a public Snapshot landing URL for the selected eval run.
 *
 * Body: { workspaceId, evalRunHistoryId, ayclToken? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const workspaceId =
      typeof body.workspaceId === "string"
        ? body.workspaceId.trim()
        : typeof body.workspace_id === "string"
          ? body.workspace_id.trim()
          : "";
    const evalRunHistoryId =
      parseEvalRunHistoryId(body.evalRunHistoryId) ||
      parseEvalRunHistoryId(body.eval_run_history_id);

    const access = await authorizeSnapshotShare(
      workspaceId,
      evalRunHistoryId,
      ayclTokenFromBody(body),
    );
    if (!access.ok) return access.response;

    const backend = createSupabaseSnapshotShareBackend(access.auth.supabase);
    const generated = await generateSnapshotShare(backend, {
      snapshotId: evalRunHistoryId,
      origin: baseUrl(req),
    });
    if (!generated.ok) {
      return jsonError(404, "Snapshot not found");
    }
    return NextResponse.json({
      token: generated.token,
      url: generated.url,
      path: generated.path,
      landing: generated.landing,
    });
  } catch (error) {
    console.error("[workspace/snapshot-share] POST failed:", error);
    return jsonError(500, "Failed to generate public snapshot URL");
  }
}
