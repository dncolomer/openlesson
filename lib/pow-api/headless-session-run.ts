import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "./types";
import { loadManagedWorkspace } from "./workspace-management";
import {
  HeadlessSessionError,
  endHeadlessSession,
  getHeadlessSession,
  ingestHeadlessProofOfWork,
  parseHeadlessFlowKind,
  presentHeadlessSession,
  startHeadlessSession,
  type HeadlessProofEventInput,
} from "./headless-session";

export async function startHeadlessSessionForWorkspace(input: {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  args: Record<string, unknown>;
}) {
  const workspace = await loadManagedWorkspace(input.supabase, input.auth, input.workspaceId);
  if (!workspace) {
    throw new HeadlessSessionError("workspace_not_found", "Workspace not found.");
  }
  const flowKind = parseHeadlessFlowKind(input.args.flow_kind);
  if (!flowKind) {
    throw new HeadlessSessionError(
      "validation_error",
      "flow_kind must be calibrate, learn, verify, or tapbench.",
    );
  }
  const blockId =
    typeof input.args.block_id === "string" && input.args.block_id.trim()
      ? input.args.block_id.trim()
      : null;
  let chapterTitle =
    typeof input.args.chapter_title === "string" ? input.args.chapter_title.trim() : "";
  let chapterBrief =
    typeof input.args.chapter_brief === "string" ? input.args.chapter_brief.trim() : "";
  if (blockId) {
    const { data: block } = await input.supabase
      .from("blocks")
      .select("id, title, description")
      .eq("id", blockId)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();
    if (!block) throw new HeadlessSessionError("block_not_found", "Block not found in this workspace.");
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
    workspaceId: input.workspaceId,
    blockId,
    flowKind,
    catalogSize: input.args.catalog_size ?? workspace.learning_model_size,
    durationMinutes: input.args.duration_minutes,
    chapterTitle,
    chapterBrief,
  });
  return presentHeadlessSession(session);
}

export async function requireWorkspaceSession(workspaceId: string, sessionId: string) {
  const session = await getHeadlessSession(sessionId);
  if (!session || session.workspace_id !== workspaceId) {
    throw new HeadlessSessionError("session_not_found", "Session not found.");
  }
  return session;
}

export async function ingestHeadlessProofForWorkspace(input: {
  workspaceId: string;
  sessionId: string;
  args: Record<string, unknown>;
}) {
  await requireWorkspaceSession(input.workspaceId, input.sessionId);
  const events: HeadlessProofEventInput[] = [];
  if (Array.isArray(input.args.events)) {
    for (const event of input.args.events) {
      if (!event || typeof event !== "object" || Array.isArray(event)) continue;
      const row = event as Record<string, unknown>;
      events.push({
        type: typeof row.type === "string" ? row.type : "tool",
        tool_name: typeof row.tool_name === "string" ? row.tool_name : undefined,
        tool_action:
          typeof row.tool_action === "string"
            ? row.tool_action
            : typeof row.toolAction === "string"
              ? row.toolAction
              : undefined,
        metadata:
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : null,
        timestamp_ms: typeof row.timestamp_ms === "number" ? row.timestamp_ms : null,
      });
    }
  }
  if (typeof input.args.tool_action === "string" && input.args.tool_action.trim()) {
    events.push({
      type: typeof input.args.type === "string" ? input.args.type : "tool",
      tool_name: typeof input.args.tool_name === "string" ? input.args.tool_name : undefined,
      tool_action: input.args.tool_action,
      metadata:
        input.args.metadata &&
        typeof input.args.metadata === "object" &&
        !Array.isArray(input.args.metadata)
          ? (input.args.metadata as Record<string, unknown>)
          : null,
      timestamp_ms: typeof input.args.timestamp_ms === "number" ? input.args.timestamp_ms : null,
    });
  }
  const session = await ingestHeadlessProofOfWork({ sessionId: input.sessionId, events });
  return presentHeadlessSession(session);
}

export async function endHeadlessSessionForWorkspace(workspaceId: string, sessionId: string) {
  await requireWorkspaceSession(workspaceId, sessionId);
  const ended = await endHeadlessSession(sessionId);
  return presentHeadlessSession(ended);
}

export function headlessErrorStatus(error: HeadlessSessionError): number {
  if (error.code === "session_not_found" || error.code === "workspace_not_found") return 404;
  if (error.code === "session_expired" || error.code === "session_ended") return 401;
  return 400;
}
