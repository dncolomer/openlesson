import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateWorkspaceProofOfWorkSpec,
} from "@/lib/agent-v2/proof-of-work-integration";
import type { ProofOfWorkSchemaRequest } from "@/lib/agent-v2/proof-of-work-schema";
import type { AuthContext } from "@/lib/agent-v2/types";
import type { WorkspaceSessionPlan } from "@/lib/agent-v2/workspace-session-access";

export async function generateProofOfWorkSchemaForWorkspace(input: {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  plan: WorkspaceSessionPlan;
  request: ProofOfWorkSchemaRequest;
  baseUrl: string;
  validateBlock?: boolean;
}) {
  const blockId = input.request.block_id ?? null;

  if (input.validateBlock && blockId) {
    const { data: block } = await input.supabase
      .from("blocks")
      .select("id")
      .eq("id", blockId)
      .eq("workspace_id", input.workspaceId)
      .single();
    if (!block) {
      return NextResponse.json(
        { error: "Block not found in this workspace" },
        { status: 404 }
      );
    }
  }

  const workspaceTitle = input.plan.title || input.plan.root_topic || "workspace";

  const { spec, contextCounts, fileIds } = await generateWorkspaceProofOfWorkSpec({
    supabase: input.supabase,
    auth: input.auth,
    workspaceId: input.workspaceId,
    workspaceTitle,
    request: input.request,
    baseUrl: input.baseUrl,
    blockId,
  });

  return {
    spec,
    contextCounts,
    fileIds,
    definition: input.request.definition,
    workspaceSummary: {
      id: input.plan.id,
      title: input.plan.title,
      root_topic: input.plan.root_topic,
    },
  };
}

export function proofOfWorkSchemaErrorResponse(
  error: unknown,
  logLabel: string
): NextResponse {
  console.error(logLabel, error);
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate proof-of-work specification",
    },
    { status: 500 }
  );
}