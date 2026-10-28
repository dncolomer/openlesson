/**
 * Content-block file bytes: upload/download via org-scoped xAI Files.
 * Pointers live on blocks.map_block.attachments (xaiFileId), not workspace_files.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  getOrgScopedFileContentResponse,
  organizationIdFromWorkspace,
  uploadOrgScopedXaiFile,
} from "@/lib/organization/org-xai-files";
import { isXaiFileId } from "@/lib/xai-files";
import {
  MAP_BLOCK_MAX_FILE_BYTES,
  mapBlockFileDownloadPath,
} from "@/lib/map-block-files";
import {
  isHeliosAllowedMimeType,
  normalizeHeliosFileMime,
} from "@/lib/workspace-helios-files";

export const runtime = "nodejs";
export const maxDuration = 30;

function estimatedBase64Bytes(data: string): number {
  return Math.ceil((String(data || "").replace(/\s+/g, "").length * 3) / 4);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId ?? body.workspace_id ?? "").trim();
    const fileName = String(body.fileName ?? body.file_name ?? body.name ?? "").trim();
    const mimeType = normalizeHeliosFileMime(
      fileName,
      String(body.mimeType ?? body.mime_type ?? ""),
    );
    const data = String(body.data ?? body.base64 ?? "").replace(/\s+/g, "");

    if (!workspaceId || !fileName || !data) {
      return jsonError(400, "workspaceId, fileName, and data are required");
    }
    if (!isHeliosAllowedMimeType(mimeType)) {
      return jsonError(400, "That file type is not supported.");
    }
    if (estimatedBase64Bytes(data) > MAP_BLOCK_MAX_FILE_BYTES) {
      return jsonError(400, "File is too large (10 MB).");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
      requireAyclAuthoring: true,
      feature: "map",
    });
    if (!auth.ok) return auth.response;

    const organizationId = await organizationIdFromWorkspace(
      auth.supabase,
      workspaceId,
    );
    let xaiFileId: string;
    try {
      const uploaded = await uploadOrgScopedXaiFile(fileName, mimeType, data, {
        organizationId,
        collectionFields: {
          workspace_id: workspaceId,
          user_id: auth.persistUserId,
          kind: "map_block",
        },
      });
      xaiFileId = uploaded.file_id;
    } catch (err) {
      console.error("[map-block-files] xAI upload failed:", err);
      return jsonError(
        502,
        err instanceof Error ? err.message : "xAI upload failed",
      );
    }
    if (!xaiFileId) return jsonError(502, "xAI upload failed");

    return NextResponse.json({
      success: true,
      xaiFileId,
      xai_file_id: xaiFileId,
      name: fileName,
      mimeType,
      url: mapBlockFileDownloadPath(workspaceId, xaiFileId, {
        name: fileName,
        mimeType,
      }),
    });
  } catch (err) {
    console.error("[map-block-files] POST error:", err);
    return jsonError(500, "Internal server error");
  }
}

export async function GET(req: NextRequest) {
  try {
    const workspaceId = String(
      req.nextUrl.searchParams.get("workspaceId") || "",
    ).trim();
    const fileId = String(req.nextUrl.searchParams.get("fileId") || "").trim();
    const ayclToken = req.nextUrl.searchParams.get("ayclToken");
    const name = String(req.nextUrl.searchParams.get("name") || "").trim();
    const mimeTypeHint = String(
      req.nextUrl.searchParams.get("mimeType") || "",
    ).trim();

    if (!workspaceId || !fileId) {
      return jsonError(400, "workspaceId and fileId are required");
    }
    if (!isXaiFileId(fileId)) {
      return jsonError(400, "Invalid file id");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken,
      feature: "map",
    });
    if (!auth.ok) return auth.response;

    const organizationId = await organizationIdFromWorkspace(
      auth.supabase,
      workspaceId,
    );
    const upstream = await getOrgScopedFileContentResponse(
      fileId,
      organizationId,
    );
    const headers = new Headers(upstream.headers);
    if (mimeTypeHint && !headers.get("content-type")) {
      headers.set("content-type", mimeTypeHint);
    }
    if (name && !headers.get("content-disposition")) {
      headers.set(
        "content-disposition",
        `attachment; filename="${name.replace(/["\r\n]+/g, "")}"`,
      );
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (err) {
    console.error("[map-block-files] GET error:", err);
    return jsonError(500, "Internal server error");
  }
}
