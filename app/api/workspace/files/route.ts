import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";

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

    if (fileId && download) {
      return jsonError(404, "File not found");
    }

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

      return NextResponse.json({ files: [] });
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
      .select("user_id, organization_id")
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

    void MAX_FILES_PER_PLAN;
    void buffer;
    return jsonError(410, "Context files were removed");
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

    void user;
    void supabase;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/workspace/files error:", err);
    return jsonError(500, "Internal server error");
  }
}
