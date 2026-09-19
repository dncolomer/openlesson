"use client";

import { useCallback, useState } from "react";
import {
  allowIleTypedInsightCreate,
  buildIleCanvasCraftInsightEvaluateRequest,
  buildIleTurnInsightPersistPayload,
  ileInsightCraftPowFromAcceptedPersist,
  ILE_CRAFT_INSIGHT_LABEL,
  ILE_INSIGHT_CRAFT_POW_FILE,
  ILE_INSIGHT_CRAFT_TOOL_ACTION,
  ILE_INSIGHT_CRAFT_TOOL_NAME,
  ILE_TURN_INSIGHT_CREATE_PATH,
  ILE_TURN_INSIGHT_EVALUATE_PATH,
  parseIleTypedInsightVerdict,
  typedInsightRecordFromVerdict,
} from "@/lib/ile-turn-insights";
import type { IlePowCounterArtifact } from "@/lib/ile-pow-counters";
import { textToBase64, uploadIleProofOfWork } from "@/lib/ile-proof-of-work-client";
import type { InsightSummary } from "@/lib/insights";
import type { IleWorkCanvasElement } from "@/lib/ile-work-canvas";

function messageFromBody(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const err = (data as { error?: unknown }).error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}

export type IleCanvasCraftInsightConfig = {
  chapterId: string;
  chapterLabel?: string | null;
  sessionId: string;
  workspaceId?: string | null;
  ileToken?: string;
  onCrafted: (insight: InsightSummary) => void;
  recordSessionPowArtifact?: (artifact: IlePowCounterArtifact) => void;
};

export function IleCanvasCraftInsightForm({
  open,
  enabled,
  selectedElements,
  config,
  onClose,
}: {
  open: boolean;
  enabled: boolean;
  selectedElements: IleWorkCanvasElement[];
  config: IleCanvasCraftInsightConfig;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"evaluate" | "persist" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refusedReason, setRefusedReason] = useState<string | null>(null);

  const persistInsight = useCallback(
    async (input: { title: string; summary: string; draftText: string }) => {
      const payload = buildIleTurnInsightPersistPayload({
        title: input.title,
        summary: input.summary,
        sessionId: config.sessionId,
        workspaceId: config.workspaceId,
        chapterId: config.chapterId,
        thoughts: [{ id: `canvas-${Date.now()}`, text: input.draftText }],
      });
      if (!payload.title || !payload.summary || !payload.chapterId) {
        setError("Insight must be linked to this chapter.");
        return false;
      }
      setBusy("persist");
      setError(null);
      try {
        const response = await fetch(ILE_TURN_INSIGHT_CREATE_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(messageFromBody(data, "Failed to save insight"));
        }
        const insight = data.insight as InsightSummary | undefined;
        if (!insight?.id) throw new Error("Failed to save insight");
        const pow = ileInsightCraftPowFromAcceptedPersist({
          persistOk: true,
          insight,
          sessionId: config.sessionId,
          workspaceId: config.workspaceId,
          chapterId: config.chapterId,
        });
        if (pow) {
          config.recordSessionPowArtifact?.(pow);
          const uploadWorkspaceId = String(
            insight.workspace_id ?? config.workspaceId ?? "",
          ).trim();
          if (uploadWorkspaceId && config.sessionId) {
            void uploadIleProofOfWork({
              workspaceId: uploadWorkspaceId,
              sessionId: config.sessionId,
              type: "tool",
              mime_type: "application/json",
              data: textToBase64(JSON.stringify(pow.metadata || {})),
              file_name: ILE_INSIGHT_CRAFT_POW_FILE,
              tool_name: ILE_INSIGHT_CRAFT_TOOL_NAME,
              tool_action: ILE_INSIGHT_CRAFT_TOOL_ACTION,
              metadata: (pow.metadata as Record<string, unknown>) || {},
              ileToken: config.ileToken,
            });
          }
        }
        config.onCrafted(insight);
        setDraft("");
        setRefusedReason(null);
        onClose();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save insight");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [config, onClose],
  );

  const handleEvaluate = useCallback(async () => {
    if (!enabled || busy) return;
    const body = buildIleCanvasCraftInsightEvaluateRequest({
      text: draft,
      chapterLabel: config.chapterLabel,
      selectedElements,
    });
    if (!body.text) {
      setError("Type an insight first.");
      return;
    }
    setBusy("evaluate");
    setError(null);
    setRefusedReason(null);
    try {
      const response = await fetch(ILE_TURN_INSIGHT_EVALUATE_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(messageFromBody(data, "Failed to evaluate insight"));
      }
      const verdict = parseIleTypedInsightVerdict(data);
      if (!allowIleTypedInsightCreate(verdict)) {
        setRefusedReason(
          verdict.reason || "Not correct or good enough to keep as an insight.",
        );
        return;
      }
      const record = typedInsightRecordFromVerdict({ draft: body.text, verdict });
      if (!record) {
        setRefusedReason("Not correct or good enough to keep as an insight.");
        return;
      }
      await persistInsight({
        title: record.title,
        summary: record.summary,
        draftText: body.text,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate insight");
    } finally {
      setBusy(null);
    }
  }, [busy, config.chapterLabel, draft, enabled, persistInsight, selectedElements]);

  if (!open) return null;

  return (
    <div
      data-ile-canvas-craft-insight
      className="pointer-events-auto flex flex-col gap-1.5 rounded-none border border-white bg-neutral-950 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
    >
      <textarea
        data-ile-canvas-craft-insight-draft
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        disabled={!enabled || busy !== null}
        placeholder="Write the takeaway in your own words."
        className="min-h-[4.5rem] w-full resize-y rounded-none border border-neutral-600 bg-neutral-900 px-2 py-1.5 text-sm text-white placeholder:text-neutral-500 focus:border-white focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-white/40"
      />
      {refusedReason ? (
        <p
          data-ile-canvas-craft-insight-refused
          className="border border-amber-300 bg-amber-300 px-2 py-1 text-[11px] text-neutral-950"
        >
          {refusedReason}
        </p>
      ) : null}
      {error ? (
        <p
          data-ile-canvas-craft-insight-error
          className="border border-red-400 bg-red-300 px-2 py-1 text-[11px] text-neutral-950"
        >
          {error}
        </p>
      ) : null}
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          data-ile-canvas-craft-insight-close
          onClick={() => {
            setDraft("");
            setError(null);
            setRefusedReason(null);
            onClose();
          }}
          disabled={busy !== null}
          className="border border-neutral-500 bg-neutral-900 px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white hover:border-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          Close
        </button>
        <button
          type="button"
          data-ile-canvas-craft-insight-submit
          onClick={() => void handleEvaluate()}
          disabled={!enabled || busy !== null || !draft.trim()}
          className="flex-1 border border-white bg-white px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:border-neutral-500 disabled:bg-neutral-200 disabled:text-neutral-500"
        >
          {busy ? "Evaluating…" : "Submit for evaluation"}
        </button>
      </div>
    </div>
  );
}

export function IleCraftInsightButton({
  usable,
  onClick,
}: {
  usable: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-ile-craft-insight
      disabled={!usable}
      onClick={onClick}
      className="pointer-events-auto shrink-0 rounded-none border border-white bg-white px-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-950 shadow-[0_12px_40px_rgba(0,0,0,0.55)] hover:bg-neutral-200 disabled:cursor-not-allowed disabled:border-white/30 disabled:bg-neutral-800 disabled:text-white/40"
    >
      {ILE_CRAFT_INSIGHT_LABEL}
    </button>
  );
}
