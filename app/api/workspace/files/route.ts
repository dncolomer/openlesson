import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute, requireAuthenticatedUser } from "@/lib/api/require-auth";
import { uploadFileToXAI, deleteFileFromXAI, getFileContentResponse } from "@/lib/xai-files";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_PLAN = 5;

// GET  /api/workspace/files?workspaceId=...            → list files for a plan
// GET  /api/workspace/files?fileId=...&download=1 → stream file content
// POST /api/workspace/files                        → upload a new file
// DELETE /api/workspace/files?fileId=...          → delete a file

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const fileId = url.searchParams.get("fileId");
    const download = url.searchParams.get("download") === "1";

    // Stream file content (proxy from xAI through our server with auth check)
    if (fileId && download) {
      const { data: file, error: fileErr } = await supabase
        .from("workspace_files")
        .select("xai_file_id, file_name, mime_type, user_id, workspace_id")
        .eq("id", fileId)
        .single();

      if (fileErr || !file) {
        console.error(`[plan-files GET download] file lookup failed for ${fileId}:`, fileErr);
        return jsonError(404, "File not found");
      }

      // Access check: owner OR plan is public
      let allowed = file.user_id === user.id;
      if (!allowed) {
        const { data: plan } = await supabase
          .from("workspaces")
          .select("is_public")
          .eq("id", file.workspace_id)
          .single();
        allowed = !!plan?.is_public;
      }
      if (!allowed) return jsonError(403, "Forbidden");

      if (!file.xai_file_id) {
        console.error(`[plan-files GET download] file ${fileId} has no xai_file_id`);
        return jsonError(410, "File has no xAI reference");
      }

      const upstream = await getFileContentResponse(file.xai_file_id);
      if (!upstream.ok || !upstream.body) {
        const errBody = await upstream.text().catch(() => "");
        console.error(
          `[plan-files GET download] xAI fetch failed for file_id=${file.xai_file_id} status=${upstream.status} body=${errBody.slice(0, 300)}`
        );
        return jsonError(502, `Failed to fetch from xAI: ${upstream.status}`);
      }

      // Stream xAI response back to client with proper headers
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": file.mime_type,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(file.file_name)}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    // List files for a plan
    if (workspaceId) {
      const { data: plan } = await supabase
        .from("workspaces")
        .select("user_id, is_public")
        .eq("id", workspaceId)
        .single();

      if (!plan) return jsonError(404, "Plan not found");
      if (plan.user_id !== user.id && !plan.is_public) {
        return jsonError(403, "Forbidden");
      }

      const { data: files, error } = await supabase
        .from("workspace_files")
        .select("id, file_name, file_size, mime_type, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      if (error) {
        return jsonError(500, "Failed to load files");
      }

      return NextResponse.json({ files: files || [] });
    }

    return jsonError(400, "workspaceId or fileId required");
  } catch (err) {
    console.error("GET /api/workspace/files error:", err);
    return jsonError(500, "Internal server error");
  }
}

// POST /api/workspace/files  body: { workspaceId, fileName, mimeType, data: base64 }
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { workspaceId, fileName, mimeType, data: base64Data } = await req.json();

    if (!workspaceId || !fileName || !mimeType || !base64Data) {
      return jsonError(400, "workspaceId, fileName, mimeType, and data are required");
    }

    // Ownership check
    const { data: plan } = await supabase
      .from("workspaces")
      .select("user_id")
      .eq("id", workspaceId)
      .single();

    if (!plan || plan.user_id !== user.id) {
      return jsonError(403, "Forbidden");
    }

    // Validate
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return jsonError(400, "Unsupported file type");
    }

    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length > MAX_FILE_SIZE) {
      return jsonError(400, "File exceeds 10 MB limit");
    }

    const { count } = await supabase
      .from("workspace_files")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    if ((count ?? 0) >= MAX_FILES_PER_PLAN) {
      return jsonError(400, "Maximum 5 files per plan");
    }

    // Upload to xAI
    let xaiFile;
    try {
      xaiFile = await uploadFileToXAI(fileName, mimeType, base64Data);
    } catch (err) {
      console.error("[plan-files POST] xAI upload failed:", err);
      return jsonError(502, err instanceof Error ? err.message : "Failed to upload to xAI");
    }

    // Insert DB row
    const { data: fileRecord, error: dbError } = await supabase
      .from("workspace_files")
      .insert({
        workspace_id: workspaceId,
        user_id: user.id,
        file_name: fileName,
        file_size: buffer.length,
        mime_type: mimeType,
        xai_file_id: xaiFile.file_id,
      })
      .select("id, file_name, file_size, mime_type, created_at")
      .single();

    if (dbError || !fileRecord) {
      // Rollback xAI upload
      await deleteFileFromXAI(xaiFile.file_id).catch(() => {});
      return jsonError(500, "Failed to save file record");
    }

    return NextResponse.json({ file: fileRecord });
  } catch (err) {
    console.error("POST /api/workspace/files error:", err);
    return jsonError(500, "Internal server error");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const url = new URL(req.url);
    const fileId = url.searchParams.get("fileId");
    if (!fileId) return jsonError(400, "fileId required");

    const { data: file } = await supabase
      .from("workspace_files")
      .select("id, user_id, xai_file_id")
      .eq("id", fileId)
      .single();

    if (!file) return jsonError(404, "File not found");
    if (file.user_id !== user.id) return jsonError(403, "Forbidden");

    // Best-effort delete from xAI (don't block local delete on failure)
    if (file.xai_file_id) {
      await deleteFileFromXAI(file.xai_file_id).catch(err =>
        console.warn(`[plan-files DELETE] xAI delete failed for ${file.xai_file_id}:`, err)
      );
    }

    await supabase.from("workspace_files").delete().eq("id", fileId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/workspace/files error:", err);
    return jsonError(500, "Internal server error");
  }
}
