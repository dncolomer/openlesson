"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  allowIleTypedInsightCreate,
  buildIleCanvasCraftInsightEvaluateRequest,
  buildIleTurnInsightPersistPayload,
  ileCanvasCraftInsightEndsLearnSession,
  ileInsightCraftPowFromAcceptedPersist,
  ileInsightWorkThoughtsSinceMark,
  ILE_CRAFT_INSIGHT_END_SESSION_HINT,
  ILE_CRAFT_INSIGHT_LABEL,
  ILE_INSIGHT_CRAFT_POW_FILE,
  ILE_INSIGHT_CRAFT_TOOL_ACTION,
  ILE_INSIGHT_CRAFT_TOOL_NAME,
  ILE_TURN_INSIGHT_CREATE_PATH,
  ILE_TURN_INSIGHT_EVALUATE_PATH,
  parseIleTypedInsightVerdict,
  typedInsightRecordFromVerdict,
} from "@/lib/learn-turn-insights";
import type { IlePowCounterArtifact } from "@/lib/learn-pow-counters";
import {
  CommandMark,
  CommandPlate,
  ILE_CANVAS_COMMAND_SIDEBAR_COMMIT_BAR_CLASS,
  ILE_CANVAS_COMMAND_SIDEBAR_COMMIT_CLASS,
  ILE_CANVAS_COMMAND_SIDEBAR_MARK_CLASS,
} from "@/components/excalidraw-canvas/command-plate";
import { textToBase64, uploadIleProofOfWork } from "@/lib/learn-proof-of-work-client";
import type { InsightSummary } from "@/lib/insights";
import type { IleWorkCanvasElement } from "@/lib/learn-work-canvas";

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
  /** Uploaded tool rows. Thoughts since `workSinceIndex` are this insight's Proof of Work. */
  workArtifacts?: readonly {
    type?: string | null;
    proof_of_work_type?: string | null;
    kind?: string | null;
    tool_action?: string | null;
    tool_name?: string | null;
  }[] | null;
  workSinceIndex?: number;
  onCrafted: (
    insight: InsightSummary,
    meta?: { endsLearnSession?: boolean },
  ) => void;
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
    async (input: {
      title: string;
      summary: string;
      draftText: string;
      endsLearnSession?: boolean;
    }) => {
      const payload = buildIleTurnInsightPersistPayload({
        title: input.title,
        summary: input.summary,
        sessionId: config.sessionId,
        workspaceId: config.workspaceId,
        chapterId: config.chapterId,
        thoughts: ileInsightWorkThoughtsSinceMark({
          artifacts: config.workArtifacts,
          sinceIndex: config.workSinceIndex,
          draft: { id: `canvas-${Date.now()}`, text: input.draftText },
        }),
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
        config.onCrafted(insight, {
          endsLearnSession: Boolean(input.endsLearnSession),
        });
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
        endsLearnSession: ileCanvasCraftInsightEndsLearnSession(verdict),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate insight");
    } finally {
      setBusy(null);
    }
  }, [busy, config.chapterLabel, draft, enabled, persistInsight, selectedElements]);

  const closeForm = useCallback(() => {
    if (busy !== null) return;
    setDraft("");
    setError(null);
    setRefusedReason(null);
    onClose();
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeForm();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeForm]);

  if (!open) return null;

  const dialog = (
    <div
      data-ile-canvas-craft-insight
      data-ile-canvas-craft-insight-modal
      className="pointer-events-auto fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      onClick={closeForm}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ILE_CRAFT_INSIGHT_LABEL}
        className="flex w-full max-w-2xl flex-col gap-3 border border-white bg-neutral-950 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.8)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.16em] text-white">
          {ILE_CRAFT_INSIGHT_LABEL}
        </h2>
        <p
          data-ile-canvas-craft-insight-end-hint
          className="font-mono text-[12px] leading-snug text-white/70"
        >
          {ILE_CRAFT_INSIGHT_END_SESSION_HINT}
        </p>
        <textarea
          data-ile-canvas-craft-insight-draft
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!enabled || busy !== null}
          placeholder="Write the takeaway in your own words."
          className="min-h-[12rem] w-full resize-y rounded-none border border-neutral-600 bg-neutral-900 px-3 py-2.5 text-base text-white placeholder:text-neutral-500 focus:border-white focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-white/40"
        />
        {refusedReason ? (
          <p
            data-ile-canvas-craft-insight-refused
            className="border border-amber-300 bg-amber-300 px-2 py-1.5 text-[12px] text-neutral-950"
          >
            {refusedReason}
          </p>
        ) : null}
        {error ? (
          <p
            data-ile-canvas-craft-insight-error
            className="border border-red-400 bg-red-300 px-2 py-1.5 text-[12px] text-neutral-950"
          >
            {error}
          </p>
        ) : null}
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            data-ile-canvas-craft-insight-close
            onClick={closeForm}
            disabled={busy !== null}
            className="border border-neutral-500 bg-neutral-900 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-white hover:border-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            Close
          </button>
          <button
            type="button"
            data-ile-canvas-craft-insight-submit
            onClick={() => void handleEvaluate()}
            disabled={!enabled || busy !== null || !draft.trim()}
            className="flex-1 border border-white bg-white px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:border-neutral-500 disabled:bg-neutral-200 disabled:text-neutral-500"
          >
            {busy ? "Evaluating…" : "Submit for evaluation"}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}

export function IleCraftInsightButton({
  usable,
  onClick,
  square = false,
  wide = false,
  plate = false,
  bar = false,
  index = "06",
}: {
  usable: boolean;
  onClick: () => void;
  /** Left and right docks: a short row with the name beside a mark. */
  square?: boolean;
  /** Sidebar board row: full width, apart from the command grid. */
  wide?: boolean;
  /** Commands grid tile. White fill so commit stays highlighted. */
  plate?: boolean;
  /** Bottom subsection: full-width bar, twice a command tile. */
  bar?: boolean;
  index?: string;
}) {
  return (
    <button
      type="button"
      data-ile-craft-insight
      data-session-command="commit"
      disabled={!usable}
      onClick={onClick}
      aria-label={ILE_CRAFT_INSIGHT_LABEL}
      title={ILE_CRAFT_INSIGHT_LABEL}
      className={
        bar
          ? ILE_CANVAS_COMMAND_SIDEBAR_COMMIT_BAR_CLASS
          : plate
          ? ILE_CANVAS_COMMAND_SIDEBAR_COMMIT_CLASS
          : square
          ? "pointer-events-auto flex min-h-9 w-full min-w-0 items-center justify-start gap-1.5 whitespace-nowrap rounded-none border border-white bg-white px-1.5 py-2 text-left font-mono text-[11px] font-semibold text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:border-white/30 disabled:bg-neutral-800 disabled:text-white/40"
          : wide
            ? "pointer-events-auto flex h-full min-h-0 w-full items-center justify-center gap-1 rounded-none border border-white bg-white px-2 py-1.5 text-[11px] text-center font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:border-white/30 disabled:bg-neutral-800 disabled:text-white/40"
          : "pointer-events-auto inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-none border border-white bg-white px-4 py-2.5 text-sm text-center font-semibold uppercase tracking-wider text-neutral-950 shadow-[0_12px_40px_rgba(0,0,0,0.55)] hover:bg-neutral-200 disabled:cursor-not-allowed disabled:border-white/30 disabled:bg-neutral-800 disabled:text-white/40"
      }
    >
      {plate || bar ? <CommandPlate index={index} /> : null}
      <CommandMark
        id="commit"
        label={ILE_CRAFT_INSIGHT_LABEL}
        className={plate && !bar ? ILE_CANVAS_COMMAND_SIDEBAR_MARK_CLASS : "h-3.5 w-3.5"}
      />
      {plate || bar ? (
        <span className="min-w-0 truncate">{ILE_CRAFT_INSIGHT_LABEL}</span>
      ) : (
        ILE_CRAFT_INSIGHT_LABEL
      )}
    </button>
  );
}
