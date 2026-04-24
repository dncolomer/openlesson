// ============================================
// OpenLesson Agentic API v2 - End Session
// POST /api/v2/agent/sessions/:id/end
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { createProof, serializeProof, createSessionBatchProof } from "@/lib/agent-v2/proofs";
import { isSolanaConfigured, anchorBatchOnChain } from "@/lib/agent-v2/solana";
import { getOrCreateUserWallet } from "@/lib/agent-v2/solana-custodial";
import { generateReport } from "@/lib/xai";
import { getFileTextContent } from "@/lib/xai-files";
import type { ProofBatch } from "@/lib/agent-v2/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchTranscriptsFromStorage(
  _supabase: SupabaseClient,
  transcriptRecords: { xai_file_id: string; chunk_index: number }[]
): Promise<string> {
  const sorted = [...transcriptRecords].sort((a, b) => a.chunk_index - b.chunk_index);
  const chunks: string[] = [];

  for (const record of sorted) {
    if (!record.xai_file_id || record.xai_file_id === "_empty") continue;
    const text = await getFileTextContent(record.xai_file_id);
    if (text && text.trim()) chunks.push(text.trim());
  }

  return chunks.join("\n\n");
}

function buildProbesSummary(
  probes: {
    text?: string;
    gap_score?: number;
    signals?: string[];
    request_type?: string;
    timestamp_ms?: number;
  }[],
  fullTranscript: string
): string {
  if (probes.length === 0) {
    return fullTranscript || "No probes were triggered during this session.";
  }

  const details = probes
    .map((p, i) => {
      const signals = (p.signals || []).join(", ") || "none";
      const score = p.gap_score?.toFixed(2) || "N/A";
      const text = p.text || "No text";
      return `[Probe ${i + 1}] Type: ${p.request_type || "unknown"}, Gap: ${score}, Signals: ${signals}\n  "${text}"`;
    })
    .join("\n\n");

  return `Probes triggered: ${probes.length}\n\n${details}\n\n---\n\nTranscript:\n${fullTranscript || "No transcript available"}`;
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const minutes = Math.round(ms / 60000);
  return `${seconds} seconds (${minutes} minutes)`;
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await authenticateRequest(req, "sessions:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;

  const { id: sessionId } = await params;

  if (!sessionId) {
    return errorResponse(400, "validation_error", "Session ID is required");
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }

  const { completion_status, user_feedback } = body as {
    completion_status?: string;
    user_feedback?: string;
  };

  try {
    // ── Fetch and validate session ─────────────────────────────────────
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      return errorResponse(404, "not_found", "Session not found");
    }

    if (session.user_id !== auth.user_id) {
      return errorResponse(403, "forbidden", "Session does not belong to this user");
    }

    if (!session.is_agent_session) {
      return errorResponse(403, "forbidden", "This endpoint is for agent sessions only");
    }

    if (session.status === "completed" || session.status === "ended_by_tutor") {
      return errorResponse(400, "session_already_ended", "Session has already ended");
    }

    // ── Fetch transcripts from storage ─────────────────────────────────
    const { data: transcriptRecords, error: transcriptErr } = await supabase
      .from("session_transcript")
      .select("xai_file_id, chunk_index, word_count, timestamp_ms")
      .eq("session_id", sessionId)
      .order("chunk_index", { ascending: true });

    if (transcriptErr) {
      console.error("[v2/sessions/:id/end] Transcript query error:", transcriptErr);
    }

    const fullTranscript = transcriptRecords?.length
      ? await fetchTranscriptsFromStorage(supabase, transcriptRecords)
      : "";

    const wordCount = fullTranscript.split(/\s+/).filter((w) => w.length > 0).length;
    const transcriptChunks = transcriptRecords?.length || 0;

    // ── Fetch analysis records for file IDs ────────────────────────────
    const { data: analysisRecords, error: analysisErr } = await supabase
      .from("session_analysis")
      .select("xai_file_id")
      .eq("session_id", sessionId);

    if (analysisErr) {
      console.error("[v2/sessions/:id/end] Analysis query error:", analysisErr);
    }

    // ── Collect all xAI file IDs for report generation ─────────────────
    const sessionFileIds: string[] = [];

    // Add transcript file IDs
    if (transcriptRecords) {
      for (const r of transcriptRecords) {
        if (r.xai_file_id && r.xai_file_id !== "_empty") {
          sessionFileIds.push(r.xai_file_id);
        }
      }
    }

    // Add analysis file IDs
    if (analysisRecords) {
      for (const r of analysisRecords as Array<{ xai_file_id: string | null }>) {
        if (r.xai_file_id) {
          sessionFileIds.push(r.xai_file_id);
        }
      }
    }

    // ── Fetch all probes ───────────────────────────────────────────────
    const { data: probes, error: probesErr } = await supabase
      .from("probes")
      .select("id, text, gap_score, signals, request_type, archived, focused, timestamp_ms, plan_step_id")
      .eq("session_id", sessionId)
      .order("timestamp_ms", { ascending: true });

    if (probesErr) {
      console.error("[v2/sessions/:id/end] Probes query error:", probesErr);
    }

    const allProbes = probes || [];
    const probeCount = allProbes.length;

    const gapScores = allProbes
      .map((p) => p.gap_score)
      .filter((s): s is number => s != null && s > 0);
    const avgGapScore =
      gapScores.length > 0
        ? gapScores.reduce((sum, s) => sum + s, 0) / gapScores.length
        : 0;

    // ── Calculate duration ─────────────────────────────────────────────
    const endedAt = new Date();
    const durationMs = session.duration_ms
      || endedAt.getTime() - new Date(session.created_at).getTime();

    // ── Generate report ────────────────────────────────────────────────
    let report: string | null = null;

    const NO_AUDIO_THRESHOLD = 50;
    if (wordCount < NO_AUDIO_THRESHOLD) {
      report = `## Session Summary\n\n**No significant audio was recorded during this session.**\n\n**Session Details:**\n- Duration: ${formatDuration(durationMs)}\n- Problem: ${session.problem}\n- Probes triggered: ${probeCount}`;
    } else {
      const probesSummary = buildProbesSummary(allProbes, fullTranscript);

      const reportResult = await generateReport({
        problem: session.problem,
        duration: formatDuration(durationMs),
        probeCount,
        avgGapScore,
        probesSummary,
        fileIds: sessionFileIds.length > 0 ? sessionFileIds : undefined,
      });

      if (reportResult.success && reportResult.report) {
        report = reportResult.report;
      } else {
        console.error("[v2/sessions/:id/end] Report generation failed:", reportResult.error);
        report = `## Session Summary\n\nReport generation failed.\n\n**Session Details:**\n- Duration: ${formatDuration(durationMs)}\n- Problem: ${session.problem}\n- Probes triggered: ${probeCount}\n- Average gap score: ${avgGapScore.toFixed(2)}`;
      }
    }

    // ── Update plan node if linked ─────────────────────────────────────
    const sessionMeta = session.metadata as Record<string, unknown> | null;
    const planNodeId = sessionMeta?.plan_node_id as string | undefined;
    let planUpdates: Record<string, unknown> | null = null;

    if (planNodeId) {
      const finalStatus = completion_status || "completed";

      const { data: nodeUpdate, error: nodeErr } = await supabase
        .from("plan_nodes")
        .update({
          status: finalStatus === "completed" ? "completed" : "in_progress",
          metadata: {
            last_session_id: sessionId,
            last_session_avg_gap: parseFloat(avgGapScore.toFixed(3)),
            last_session_probe_count: probeCount,
            last_session_duration_ms: durationMs,
            updated_at: endedAt.toISOString(),
          },
        })
        .eq("id", planNodeId)
        .select("id, status, title")
        .single();

      if (nodeErr) {
        console.warn("[v2/sessions/:id/end] Plan node update error:", nodeErr);
      } else if (nodeUpdate) {
        planUpdates = {
          node_id: nodeUpdate.id,
          node_title: nodeUpdate.title,
          node_status: nodeUpdate.status,
        };
      }
    }

    // ── Update session ─────────────────────────────────────────────────
    const endMetadata = {
      ...(sessionMeta || {}),
      completion_status: completion_status || "completed",
      user_feedback: user_feedback || null,
      ended_by: "agent_api",
    };

    const { data: updated, error: updateErr } = await supabase
      .from("sessions")
      .update({
        status: "completed",
        report,
        duration_ms: durationMs,
        ended_at: endedAt.toISOString(),
        metadata: endMetadata,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (updateErr || !updated) {
      console.error("[v2/sessions/:id/end] Update error:", updateErr);
      return errorResponse(500, "internal_error", "Failed to end session");
    }

    // ── Create session batch proof ─────────────────────────────────────
    const batchProof = await createSessionBatchProof(supabase, {
      session_id: sessionId,
      user_id: auth.user_id,
    });

    // ── Anchor batch on Solana (if configured) ─────────────────────────
    let batchAnchor: { tx_signature: string; slot: number; timestamp: string } | null = null;

    if (batchProof && isSolanaConfigured()) {
      try {
        // Fetch the full batch record
        const { data: batchRecord } = await supabase
          .from("agent_proof_batches")
          .select("*")
          .eq("id", batchProof.batch_id)
          .single();

        if (batchRecord) {
          await getOrCreateUserWallet(supabase, auth.user_id);
          const { data: walletRow } = await supabase
            .from("user_solana_wallets")
            .select("pubkey, encrypted_private_key")
            .eq("user_id", auth.user_id)
            .single();

          if (walletRow) {
            const result = await anchorBatchOnChain(
              batchRecord as ProofBatch,
              { pubkey: walletRow.pubkey, encryptedPrivateKey: walletRow.encrypted_private_key },
            );

            if (result) {
              batchAnchor = {
                tx_signature: result.txSignature,
                slot: result.slot,
                timestamp: result.timestamp,
              };

              // Update batch record with anchor data
              await supabase
                .from("agent_proof_batches")
                .update({
                  anchored: true,
                  anchor_tx_signature: result.txSignature,
                  anchor_slot: result.slot,
                  anchor_timestamp: result.timestamp,
                })
                .eq("id", batchProof.batch_id);

              // Update wallet stats
              const { data: walletStats } = await supabase
                .from("user_solana_wallets")
                .select("total_anchored_batches")
                .eq("user_id", auth.user_id)
                .single();

              await supabase
                .from("user_solana_wallets")
                .update({
                  total_anchored_batches: (walletStats?.total_anchored_batches || 0) + 1,
                  last_anchor_at: result.timestamp,
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", auth.user_id);
            }
          }
        }
      } catch (anchorErr) {
        // Batch anchoring is non-critical — log and continue
        console.error("[v2/sessions/:id/end] Batch anchoring error:", anchorErr);
      }
    }

    // ── Create end-session proof ───────────────────────────────────────
    const proof = await createProof(supabase, {
      type: "session_ended",
      user_id: auth.user_id,
      session_id: sessionId,
      event_data: {
        completion_status: completion_status || "completed",
        duration_ms: durationMs,
        probe_count: probeCount,
        avg_gap_score: parseFloat(avgGapScore.toFixed(3)),
        word_count: wordCount,
        has_report: !!report,
        batch_proof_id: batchProof?.batch_id || null,
      },
    });

    // ── Build statistics ───────────────────────────────────────────────
    const statistics = {
      duration_ms: durationMs,
      total_probes: probeCount,
      active_probes: allProbes.filter((p) => !p.archived).length,
      archived_probes: allProbes.filter((p) => p.archived).length,
      avg_gap_score: parseFloat(avgGapScore.toFixed(3)),
      transcript_chunks: transcriptChunks,
      total_words: wordCount,
      gap_score_trend: gapScores.length >= 3
        ? gapScores.slice(-3)
        : gapScores,
    };

    return NextResponse.json({
      session: {
        id: updated.id,
        status: updated.status,
        problem: updated.problem,
        duration_ms: updated.duration_ms,
        created_at: updated.created_at,
        ended_at: updated.ended_at,
      },
      report,
      statistics,
      plan_updates: planUpdates,
      proof: proof ? serializeProof(proof) : null,
      batch_proof: batchProof
        ? {
            batch_id: batchProof.batch_id,
            merkle_root: batchProof.merkle_root,
            ...(batchAnchor
              ? {
                  anchored: true,
                  anchor_tx_signature: batchAnchor.tx_signature,
                  anchor_slot: batchAnchor.slot,
                  anchor_timestamp: batchAnchor.timestamp,
                }
              : { anchored: false }),
          }
        : null,
    });
  } catch (err) {
    console.error("[v2/sessions/:id/end] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
