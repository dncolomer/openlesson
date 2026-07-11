import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callXaiJSON, callXaiResponsesWithFiles, systemMessage, userMessage } from "@/lib/xai-client";
import { GHC_SCORE_MARKERS, getGhcScoreBrief, getGhcScoreBriefForUser, GhcScoreAnalysis, GhcScoreMode, hashPrivateToken } from "@/lib/ghc-score";
import { resolveGhlSessionAccess } from "@/lib/ghl-score-session-auth";
import {
  buildTraceScoringContext,
  buildTraceScoringInstructions,
  fetchGhlSessionTraces,
  GHL_SCORE_ANALYSIS_SCHEMA,
} from "@/lib/ghl-score-traces";
import { uploadFileToXAI } from "@/lib/xai-files";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    let workspaceId = String(body.workspaceId || "");
    const transcript = Array.isArray(body.transcript) ? body.transcript : [];
    const durationSeconds = Number(body.durationSeconds || 0);
    let requestedDurationSeconds = Number(body.requestedDurationSeconds || 0);
    let mode = "curious" as GhcScoreMode;
    let voice = String(body.voice || "ara");
    let focusNodeIds = Array.isArray(body.focusNodeIds) ? body.focusNodeIds.filter(Boolean) : [];
    let blockId = body.blockId ? String(body.blockId) : null;
    let focusSessionId = body.sessionId ? String(body.sessionId) : null;
    const xaiConversationId = body.xaiConversationId ? String(body.xaiConversationId) : null;
    const ghlSessionId = body.ghlSessionId ? String(body.ghlSessionId) : "";
    let existingSession: any = null;

    if (transcript.length === 0) return NextResponse.json({ error: "transcript is required" }, { status: 400 });

    let userId: string;
    let brief: any;
    let supabase: any;

    if (privateToken) {
      supabase = createAdminClient();
      const { data: session, error } = await supabase
        .from("workspace_ghc_sessions")
        .select("id, workspace_id, user_id, guest_user_id, organization_id, requested_duration_seconds, mode, voice_id, focus_block_ids, status, block_id, session_id, workspaces!inner(user_id)")
        .eq("private_token_hash", hashPrivateToken(privateToken))
        .single();

      if (error || !session) return NextResponse.json({ error: "GHL Score block not found" }, { status: 404 });
      if (session.status === "completed") return NextResponse.json({ error: "GHL Score block is already completed" }, { status: 409 });
      existingSession = session;
      workspaceId = session.workspace_id;
      userId = session.user_id || (session as any).workspaces?.user_id;
      mode = "curious";
      voice = session.voice_id || "ara";
      focusNodeIds = session.focus_block_ids || [];
      blockId = session.block_id || null;
      focusSessionId = session.session_id || null;
      requestedDurationSeconds = session.requested_duration_seconds || requestedDurationSeconds;
      ({ brief } = await getGhcScoreBriefForUser(workspaceId, userId, focusNodeIds, true, focusSessionId));
    } else {
      if (!workspaceId) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
      supabase = await createClient();
      if (blockId && !focusNodeIds.includes(blockId)) focusNodeIds = [blockId, ...focusNodeIds];
      ({ userId, brief } = await getGhcScoreBrief(workspaceId, focusNodeIds, focusSessionId));

      if (ghlSessionId) {
        const access = await resolveGhlSessionAccess({
          workspaceId,
          ghlSessionId,
          blockId,
          focusSessionId,
        });
        if ("error" in access) {
          return NextResponse.json({ error: access.error }, { status: access.status });
        }
        existingSession = access.existingSession;
        supabase = access.supabase;
      }
    }

    const transcriptText = transcript
      .map((entry: any) => `${entry.role || "unknown"}: ${entry.text || entry.content || ""}`)
      .join("\n");

    const resolvedGhlSessionId = existingSession?.id || ghlSessionId || null;
    let traceContext = {
      system1Count: 0,
      system2Count: 0,
      manifestText: "",
      fileIds: [] as string[],
    };

    if (resolvedGhlSessionId) {
      const traces = await fetchGhlSessionTraces(supabase, resolvedGhlSessionId, workspaceId);
      traceContext = buildTraceScoringContext(traces);
    }

    const traceInstructions = buildTraceScoringInstructions(traceContext);
    const scoringPrompt = `Workspace: ${brief.plan.title}
Topic: ${brief.plan.root_topic}
Description: ${brief.plan.description || "n/a"}
Notes: ${brief.plan.notes || "n/a"}
Nodes: ${JSON.stringify(brief.nodes)}
Focused session: ${JSON.stringify(brief.focusSession || null)}

GHL Score transcript (System 2 dialogue — thoughts the learner explicitly submitted to the probe):
${transcriptText}
${traceInstructions}

Return JSON with:
{
  "overall_score": number from 0 to 100 (learning verification from the TAP demonstration),
  "conversion_score": number from 0 to 100 (estimated likelihood of achieving the workspace conversion goal — infer goal from workspace context when not explicit),
  "conversion_goal": string (what conversion means for this workspace, e.g. "Trial activation", "Certification sign-off"),
  "markers": ${JSON.stringify(GHC_SCORE_MARKERS.map((marker) => ({ ...marker, score: "number from 0 to 100", rationale: "string" })))},
  "gap_analysis": {
    "summary": string,
    "gaps": [{ "title": string, "proof_of_work": string, "severity": "low" | "medium" | "high", "suggested_repair": string }],
    "next_practice": string[]
  },
  "knowledge_gaps": [{ "title": string, "proof_of_work": string, "severity": "low" | "medium" | "high", "suggested_repair": string }],
  "overall_reflection": string,
  "strengths": string[],
  "growth_areas": string[],
  "follow_up_prompts": string[],
  "confidence": "emerging" | "developing" | "clear" | "well-connected"
}`;

    const systemPrompt =
      "You create Think Aloud Protocol (TAP) score analyses for OpenLesson. Return only JSON. Scores are provisional from 0 to 100, not clinical or identity claims. overall_score measures learning verification from the demonstration; conversion_score estimates likelihood of achieving the workspace conversion goal (infer conversion_goal from workspace title, description, notes, and blocks when not explicit). Identify actionable gap analysis, then provide supporting marker scores. When thought trace files are attached, treat System 1 and System 2 traces as evidence alongside the dialogue transcript.";

    const result =
      traceContext.fileIds.length > 0
        ? await callXaiResponsesWithFiles<GhcScoreAnalysis>(
            scoringPrompt,
            traceContext.fileIds,
            {
              instructions: systemPrompt,
              maxOutputTokens: 2000,
              temperature: 0.4,
              fetchTimeout: 120000,
              jsonSchema: GHL_SCORE_ANALYSIS_SCHEMA,
            },
          )
        : await callXaiJSON<GhcScoreAnalysis>([systemMessage(systemPrompt), userMessage(scoringPrompt)], {
            maxTokens: 2000,
            temperature: 0.4,
            fetchTimeout: 120000,
          });

    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || "Failed to generate GHL Score" }, { status: 500 });
    }

    const markerScores = Array.isArray(result.data.markers) ? result.data.markers : [];
    const payload = {
      workspace_id: workspaceId,
      user_id: existingSession ? existingSession.user_id : userId,
      guest_user_id: existingSession?.guest_user_id || null,
      organization_id: existingSession?.organization_id || null,
      duration_seconds: durationSeconds,
      requested_duration_seconds: requestedDurationSeconds,
      block_id: blockId,
      session_id: focusSessionId,
      mode,
      focus_block_ids: focusNodeIds,
      voice_id: voice,
      status: "completed",
      transcript,
      summary: result.data.overall_reflection,
      analysis: {
        ...result.data,
        gap_analysis: result.data.gap_analysis || {
          summary: result.data.knowledge_gaps?.length ? "Learning gaps were identified from the demonstration." : "No major learning gaps were identified from the demonstration.",
          gaps: result.data.knowledge_gaps || [],
          next_practice: result.data.follow_up_prompts || [],
        },
      },
      overall_score: Math.max(0, Math.min(100, Math.round(Number(result.data.overall_score) || 0))),
      marker_scores: markerScores,
      xai_conversation_id: xaiConversationId,
      completed_at: new Date().toISOString(),
    };

    const query = existingSession
      ? supabase.from("workspace_ghc_sessions").update(payload).eq("id", existingSession.id)
      : supabase.from("workspace_ghc_sessions").insert(payload);

    const { data: row, error: writeError } = await query
      .select("id, workspace_id, session_id, block_id, analysis, summary, overall_score, marker_scores, status, created_at, completed_at")
      .single();

    if (writeError) {
      console.error("[workspace-ghl-score/complete] Write error:", writeError);
      return NextResponse.json({ error: writeError.message }, { status: 500 });
    }

    let xaiFileId: string | null = null;
    try {
      const artifact = {
        type: "openlesson_ghl_score",
        ghl_session_id: row.id,
        workspace_id: row.workspace_id,
        block_id: row.block_id,
        session_id: row.session_id,
        completed_at: row.completed_at,
        summary: row.summary,
        overall_score: row.overall_score,
        marker_scores: row.marker_scores,
        analysis: row.analysis,
        transcript,
        thought_traces: {
          system1_count: traceContext.system1Count,
          system2_count: traceContext.system2Count,
          manifest: traceContext.manifestText,
          xai_file_ids: traceContext.fileIds,
        },
      };
      const base64 = Buffer.from(JSON.stringify(artifact, null, 2), "utf8").toString("base64");
      const uploaded = await uploadFileToXAI(`ghl-score-${row.id}.json`, "application/json", base64);
      xaiFileId = uploaded.file_id;
      await supabase.from("workspace_ghc_sessions").update({ xai_file_id: xaiFileId }).eq("id", row.id);
    } catch (uploadError) {
      console.warn("[workspace-ghl-score/complete] xAI artifact upload failed:", uploadError);
    }

    return NextResponse.json({ ghlSession: { ...row, xai_file_id: xaiFileId } });
  } catch (error) {
    console.error("[workspace-ghl-score/complete] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Not authenticated" ? 401 : message === "Not authorized" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
