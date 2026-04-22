import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

// GET  /api/learning-plan/files?planId=...            → list files for a plan
// GET  /api/learning-plan/files?fileId=...&download=1 → stream file content
// POST /api/learning-plan/files                        → upload a new file
// DELETE /api/learning-plan/files?fileId=...          → delete a file

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const planId = url.searchParams.get("planId");
    const fileId = url.searchParams.get("fileId");
    const download = url.searchParams.get("download") === "1";

    // Stream file content (proxy from xAI through our server with auth check)
    if (fileId && download) {
      const { data: file, error: fileErr } = await supabase
        .from("plan_files")
        .select("xai_file_id, file_name, mime_type, user_id, plan_id")
        .eq("id", fileId)
        .single();

      if (fileErr || !file) {
        console.error(`[plan-files GET download] file lookup failed for ${fileId}:`, fileErr);
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      // Access check: owner OR plan is public
      let allowed = file.user_id === user.id;
      if (!allowed) {
        const { data: plan } = await supabase
          .from("learning_plans")
          .select("is_public")
          .eq("id", file.plan_id)
          .single();
        allowed = !!plan?.is_public;
      }
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      if (!file.xai_file_id) {
        console.error(`[plan-files GET download] file ${fileId} has no xai_file_id`);
        return NextResponse.json({ error: "File has no xAI reference" }, { status: 410 });
      }

      const upstream = await getFileContentResponse(file.xai_file_id);
      if (!upstream.ok || !upstream.body) {
        const errBody = await upstream.text().catch(() => "");
        console.error(
          `[plan-files GET download] xAI fetch failed for file_id=${file.xai_file_id} status=${upstream.status} body=${errBody.slice(0, 300)}`
        );
        return NextResponse.json(
          { error: `Failed to fetch from xAI: ${upstream.status}` },
          { status: 502 }
        );
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
    if (planId) {
      const { data: plan } = await supabase
        .from("learning_plans")
        .select("user_id, is_public")
        .eq("id", planId)
        .single();

      if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      if (plan.user_id !== user.id && !plan.is_public) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { data: files, error } = await supabase
        .from("plan_files")
        .select("id, file_name, file_size, mime_type, created_at")
        .eq("plan_id", planId)
        .order("created_at", { ascending: true });

      if (error) {
        return NextResponse.json({ error: "Failed to load files" }, { status: 500 });
      }

      return NextResponse.json({ files: files || [] });
    }

    return NextResponse.json({ error: "planId or fileId required" }, { status: 400 });
  } catch (err) {
    console.error("GET /api/learning-plan/files error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/learning-plan/files  body: { planId, fileName, mimeType, data: base64 }
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { planId, fileName, mimeType, data: base64Data } = await req.json();

    if (!planId || !fileName || !mimeType || !base64Data) {
      return NextResponse.json({ error: "planId, fileName, mimeType, and data are required" }, { status: 400 });
    }

    // Ownership check
    const { data: plan } = await supabase
      .from("learning_plans")
      .select("user_id")
      .eq("id", planId)
      .single();

    if (!plan || plan.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 400 });
    }

    const { count } = await supabase
      .from("plan_files")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId);

    if ((count ?? 0) >= MAX_FILES_PER_PLAN) {
      return NextResponse.json({ error: "Maximum 5 files per plan" }, { status: 400 });
    }

    // Upload to xAI
    let xaiFile;
    try {
      xaiFile = await uploadFileToXAI(fileName, mimeType, base64Data);
    } catch (err) {
      console.error("[plan-files POST] xAI upload failed:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to upload to xAI" },
        { status: 502 }
      );
    }

    // Insert DB row
    const { data: fileRecord, error: dbError } = await supabase
      .from("plan_files")
      .insert({
        plan_id: planId,
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
      return NextResponse.json({ error: "Failed to save file record" }, { status: 500 });
    }

    return NextResponse.json({ file: fileRecord });
  } catch (err) {
    console.error("POST /api/learning-plan/files error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const fileId = url.searchParams.get("fileId");
    if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });

    const { data: file } = await supabase
      .from("plan_files")
      .select("id, user_id, xai_file_id")
      .eq("id", fileId)
      .single();

    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
    if (file.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Best-effort delete from xAI (don't block local delete on failure)
    if (file.xai_file_id) {
      await deleteFileFromXAI(file.xai_file_id).catch(err =>
        console.warn(`[plan-files DELETE] xAI delete failed for ${file.xai_file_id}:`, err)
      );
    }

    await supabase.from("plan_files").delete().eq("id", fileId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/learning-plan/files error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
