"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lightbulb, PenLine, Sparkles } from "lucide-react";
import { DialogFrame } from "@/components/ui/DialogFrame";
import {
  FALLBACK_AESTHETIC_IMAGES,
  resolveIleWorkAestheticImage,
} from "@/lib/aesthetics";
import {
  allowIleTypedInsightCreate,
  buildIleThoughtsPoolCandidateRequest,
  buildIleTurnInsightPersistPayload,
  buildIleTypedInsightEvaluateRequest,
  canCompleteIleTurnInsightCraft,
  ileInsightCraftPowFromAcceptedPersist,
  ileTurnInsightSlotCount,
  ILE_INSIGHT_CRAFT_POW_FILE,
  ILE_INSIGHT_CRAFT_TOOL_ACTION,
  ILE_INSIGHT_CRAFT_TOOL_NAME,
  ILE_TURN_INSIGHT_CREATE_PATH,
  ILE_TURN_INSIGHT_EVALUATE_PATH,
  ILE_TURN_INSIGHT_SUGGEST_PATH,
  parseIleTypedInsightVerdict,
  remainingIleTurnInsightSlots,
  typedInsightRecordFromVerdict,
  type IleTurnInsightThought,
} from "@/lib/ile-turn-insights";
import type { IlePowCounterArtifact } from "@/lib/ile-pow-counters";
import { textToBase64, uploadIleProofOfWork } from "@/lib/ile-proof-of-work-client";
import {
  insightPublicPath,
  type InsightSummary,
} from "@/lib/insights";
import type { IleWorkDockLabel } from "@/components/session-view/ile-work-dock-bar";

type CraftPath = "type" | "pool";

type InsightCandidate = {
  title: string;
  summary: string;
  thoughtIds: string[];
};

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

export function IleTurnInsightCraft({
  open,
  aestheticImage,
  dockedChapters,
  thoughts,
  unusedPow,
  workspaceId,
  sessionId,
  ileToken,
  onCrafted,
  recordSessionPowArtifact,
  onContinue,
  onSaveAndExit,
  portal = true,
}: {
  open: boolean;
  aestheticImage?: string | null;
  dockedChapters: IleWorkDockLabel[];
  thoughts: readonly IleTurnInsightThought[];
  unusedPow: number;
  workspaceId?: string | null;
  sessionId: string;
  ileToken?: string;
  onCrafted: (insight: InsightSummary) => void;
  recordSessionPowArtifact?: (artifact: IlePowCounterArtifact) => void;
  onContinue: () => void;
  onSaveAndExit: () => void;
  /** False inside Document PiP so the overlay stays in that window. */
  portal?: boolean;
}) {
  const slotCount = ileTurnInsightSlotCount(unusedPow);
  const [path, setPath] = useState<CraftPath>("type");
  const [draft, setDraft] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [linkedChapterId, setLinkedChapterId] = useState<string | null>(null);
  const [crafted, setCrafted] = useState<InsightSummary[]>([]);
  const [candidates, setCandidates] = useState<InsightCandidate[]>([]);
  const [busy, setBusy] = useState<"evaluate" | "suggest" | "persist" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refusedReason, setRefusedReason] = useState<string | null>(null);

  const backdrop =
    (aestheticImage && aestheticImage.trim()) ||
    FALLBACK_AESTHETIC_IMAGES[0] ||
    "";
  const remaining = remainingIleTurnInsightSlots({
    unusedPow,
    craftedCount: crafted.length,
  });
  const canFinish = canCompleteIleTurnInsightCraft({
    craftedCount: crafted.length,
    unusedPow,
  });
  const slotsOpen = remaining > 0 && !busy;

  const linkedChapter = dockedChapters.find((row) => row.id === linkedChapterId);
  const poolThoughts = useMemo(
    () => thoughts.filter((thought) => thought?.id && String(thought.text || "").trim()),
    [thoughts],
  );

  useEffect(() => {
    if (!open) return;
    setPath("type");
    setDraft("");
    setSelectedIds(new Set());
    setLinkedChapterId(null);
    setCrafted([]);
    setCandidates([]);
    setBusy(null);
    setError(null);
    setRefusedReason(null);
  }, [open]);

  const persistInsight = useCallback(
    async (input: {
      title: string;
      summary: string;
      thoughts?: IleTurnInsightThought[];
      thoughtIds?: string[];
    }) => {
      const payload = buildIleTurnInsightPersistPayload({
        title: input.title,
        summary: input.summary,
        sessionId,
        workspaceId,
        chapterId: linkedChapterId,
        thoughts: input.thoughts,
        thoughtIds: input.thoughtIds,
      });
      if (!payload.title || !payload.summary) {
        setError("Insight title and summary are required.");
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
          sessionId,
          workspaceId,
          chapterId: linkedChapterId,
        });
        if (pow) {
          recordSessionPowArtifact?.(pow);
          const uploadWorkspaceId = String(
            insight.workspace_id ?? workspaceId ?? "",
          ).trim();
          if (uploadWorkspaceId && sessionId) {
            void uploadIleProofOfWork({
              workspaceId: uploadWorkspaceId,
              sessionId,
              type: "tool",
              mime_type: "application/json",
              data: textToBase64(JSON.stringify(pow.metadata || {})),
              file_name: ILE_INSIGHT_CRAFT_POW_FILE,
              tool_name: ILE_INSIGHT_CRAFT_TOOL_NAME,
              tool_action: ILE_INSIGHT_CRAFT_TOOL_ACTION,
              metadata: (pow.metadata as Record<string, unknown>) || {},
              ileToken,
            });
          }
        }
        setCrafted((current) => [insight, ...current]);
        onCrafted(insight);
        setDraft("");
        setCandidates([]);
        setSelectedIds(new Set());
        setRefusedReason(null);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save insight");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [ileToken, linkedChapterId, onCrafted, recordSessionPowArtifact, sessionId, workspaceId],
  );

  const handleEvaluate = useCallback(async () => {
    if (!slotsOpen) return;
    const body = buildIleTypedInsightEvaluateRequest({
      text: draft,
      chapterLabel: linkedChapter
        ? `${linkedChapter.label}${linkedChapter.keyword ? ` · ${linkedChapter.keyword}` : ""}`
        : null,
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
        thoughts: [{ id: `typed-${Date.now()}`, text: body.text }],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate insight");
    } finally {
      setBusy(null);
    }
  }, [draft, linkedChapter, persistInsight, slotsOpen]);

  const handleSuggest = useCallback(async () => {
    if (!slotsOpen) return;
    const request = buildIleThoughtsPoolCandidateRequest({
      thoughts: poolThoughts,
      selectedIds: [...selectedIds],
    });
    if (request.thoughts.length < 2) {
      setError("Select at least two thoughts from the pool.");
      return;
    }
    setBusy("suggest");
    setError(null);
    try {
      const response = await fetch(ILE_TURN_INSIGHT_SUGGEST_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(messageFromBody(data, "Failed to generate insight candidates"));
      }
      const next = Array.isArray(data.suggestions)
        ? (data.suggestions as InsightCandidate[]).filter(
            (row) => row?.title?.trim() && row?.summary?.trim(),
          )
        : [];
      setCandidates(next);
      if (next.length === 0) {
        setError("No strong insight candidates from that selection. Try different thoughts.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate insight candidates");
      setCandidates([]);
    } finally {
      setBusy(null);
    }
  }, [poolThoughts, selectedIds, slotsOpen]);

  const handleAcceptCandidate = useCallback(
    async (candidate: InsightCandidate) => {
      if (!slotsOpen) return;
      const selected = poolThoughts.filter((thought) =>
        candidate.thoughtIds?.includes(thought.id),
      );
      await persistInsight({
        title: candidate.title,
        summary: candidate.summary,
        thoughts: selected.length > 0 ? selected : poolThoughts.filter((thought) => selectedIds.has(thought.id)),
        thoughtIds: candidate.thoughtIds,
      });
    },
    [persistInsight, poolThoughts, selectedIds, slotsOpen],
  );

  const toggleThought = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <DialogFrame
      open={open}
      onClose={() => {}}
      closeOnOverlay={false}
      closeOnEscape={false}
      portal={portal}
      size="full"
      testId="ile-turn-insight-craft"
      labelledBy="ile-turn-insight-craft-title"
      panelClassName="flex max-h-[min(94vh,56rem)] min-h-[min(86vh,40rem)] flex-col bg-neutral-950"
    >
      <div
        data-ile-turn-insight-craft
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div
          data-ile-turn-insight-craft-still
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: backdrop ? `url(${backdrop})` : undefined }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/45"
        />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-white/15 px-5 py-4 sm:px-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/55">
              Turn close
            </p>
            <h2
              id="ile-turn-insight-craft-title"
              className="mt-1 font-mono text-xl font-semibold uppercase tracking-wide text-white sm:text-2xl"
            >
              Craft insights
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-white/70">
              Name what you learned this turn. You can finish without crafting any.
            </p>
            <p
              data-ile-turn-insight-slots
              className="mt-3 inline-flex items-center gap-2 border border-white bg-white px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-950"
            >
              <Lightbulb className="size-3.5" strokeWidth={2.3} aria-hidden />
              {crafted.length} of {slotCount} insights this turn
              {remaining === 0 ? " · no unused PoW left for more" : ` · ${remaining} open`}
            </p>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-7">
            {dockedChapters.length > 0 ? (
              <section data-ile-turn-insight-chapters>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-white/55">
                  Link to an active chapter
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  {dockedChapters.map((work) => {
                    const selected = linkedChapterId === work.id;
                    const chipImage = resolveIleWorkAestheticImage({
                      id: work.id,
                      assigned: work.image,
                      images: FALLBACK_AESTHETIC_IMAGES,
                    });
                    return (
                      <button
                        key={work.id}
                        type="button"
                        data-ile-turn-insight-chapter={work.id}
                        aria-pressed={selected}
                        onClick={() =>
                          setLinkedChapterId((current) =>
                            current === work.id ? null : work.id,
                          )
                        }
                        className={`relative flex h-20 w-[6.5rem] shrink-0 flex-col items-stretch justify-end overflow-hidden rounded-none border ${
                          selected
                            ? "border-white shadow-[0_0_0_1px_#fff]"
                            : "border-white/30 hover:border-white/70"
                        }`}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-0 bg-cover bg-center"
                          style={{ backgroundImage: `url(${chipImage})` }}
                        />
                        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                        <span className="relative z-10 px-1.5 pb-1.5 font-mono text-[10px] font-semibold uppercase leading-tight tracking-wide text-white">
                          {work.keyword || work.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <div className="flex shrink-0 gap-1 border border-white/20 bg-black/40 p-1">
              <button
                type="button"
                data-ile-turn-insight-path="type"
                onClick={() => setPath("type")}
                className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider ${
                  path === "type"
                    ? "bg-white text-neutral-950"
                    : "text-white/80 hover:bg-white/10"
                }`}
              >
                <PenLine className="size-3.5" strokeWidth={2.3} aria-hidden />
                Type an insight
              </button>
              <button
                type="button"
                data-ile-turn-insight-path="pool"
                onClick={() => setPath("pool")}
                className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider ${
                  path === "pool"
                    ? "bg-white text-neutral-950"
                    : "text-white/80 hover:bg-white/10"
                }`}
              >
                <Sparkles className="size-3.5" strokeWidth={2.3} aria-hidden />
                Thoughts pool
              </button>
            </div>

            {path === "type" ? (
              <section data-ile-turn-insight-type className="flex min-h-[12rem] flex-col gap-2">
                <textarea
                  data-ile-turn-insight-draft
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={!slotsOpen}
                  placeholder="Write the takeaway in your own words. xAI will check if it is correct / good enough."
                  className="min-h-[10rem] w-full resize-y rounded-none border border-white/25 bg-black/55 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-white focus:outline-none disabled:opacity-40"
                />
                {refusedReason ? (
                  <p
                    data-ile-turn-insight-refused
                    className="border border-amber-300/50 bg-amber-300/10 px-3 py-2 text-sm text-amber-100"
                  >
                    {refusedReason}
                  </p>
                ) : null}
                <button
                  type="button"
                  data-ile-turn-insight-evaluate
                  onClick={() => void handleEvaluate()}
                  disabled={!slotsOpen || busy !== null}
                  className="self-start border border-white bg-white px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === "evaluate" || busy === "persist" ? "Evaluating…" : "Evaluate insight"}
                </button>
              </section>
            ) : (
              <section data-ile-turn-insight-pool className="flex min-h-[12rem] flex-col gap-2">
                <div className="max-h-48 overflow-y-auto border border-white/20 bg-black/50">
                  {poolThoughts.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-white/55">
                      No thoughts in the pool yet. Type an insight instead, or continue.
                    </p>
                  ) : (
                    poolThoughts.map((thought) => {
                      const selected = selectedIds.has(thought.id);
                      return (
                        <button
                          key={thought.id}
                          type="button"
                          data-ile-turn-insight-thought={thought.id}
                          onClick={() => toggleThought(thought.id)}
                          className={`flex w-full items-start gap-2 border-b border-white/10 px-3 py-2 text-left text-sm ${
                            selected ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/5"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`mt-0.5 size-3 shrink-0 border ${
                              selected ? "border-white bg-white" : "border-white/50"
                            }`}
                          />
                          <span>{thought.text}</span>
                        </button>
                      );
                    })
                  )}
                </div>
                <button
                  type="button"
                  data-ile-turn-insight-generate
                  onClick={() => void handleSuggest()}
                  disabled={!slotsOpen || busy !== null}
                  className="self-start border border-white bg-white px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === "suggest" ? "Generating…" : "Generate insight candidates"}
                </button>
                {candidates.length > 0 ? (
                  <ul data-ile-turn-insight-candidates className="flex flex-col gap-2">
                    {candidates.map((candidate) => (
                      <li
                        key={`${candidate.title}:${candidate.thoughtIds.join(",")}`}
                        className="border border-white/20 bg-black/55 px-3 py-2"
                      >
                        <p className="font-mono text-[12px] font-semibold uppercase tracking-wide text-white">
                          {candidate.title}
                        </p>
                        <p className="mt-1 text-sm text-white/75">{candidate.summary}</p>
                        <button
                          type="button"
                          data-ile-turn-insight-accept
                          onClick={() => void handleAcceptCandidate(candidate)}
                          disabled={!slotsOpen || busy !== null}
                          className="mt-2 border border-white px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-white hover:bg-white hover:text-neutral-950 disabled:opacity-40"
                        >
                          Accept insight
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            )}

            {crafted.length > 0 ? (
              <ul data-ile-turn-insight-crafted className="flex flex-col gap-2 border-t border-white/15 pt-3">
                {crafted.map((insight) => (
                  <li key={insight.id} className="border border-white/20 bg-black/40 px-3 py-2">
                    <p className="font-mono text-[12px] font-semibold uppercase tracking-wide text-white">
                      {insight.title}
                    </p>
                    <p className="mt-1 text-sm text-white/70">{insight.summary}</p>
                    <a
                      href={insightPublicPath(insight)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block font-mono text-[10px] uppercase tracking-wider text-white/80 underline"
                    >
                      Open insight
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}

            {error ? (
              <p data-ile-turn-insight-error className="text-sm text-red-300">
                {error}
              </p>
            ) : null}
          </div>

          <footer className="flex shrink-0 flex-col gap-2 border-t border-white/15 bg-black/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <button
              type="button"
              data-ile-turn-insight-save-exit
              onClick={onSaveAndExit}
              disabled={!canFinish || busy !== null}
              className="border border-white/50 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-white hover:border-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save and go out of the workspace
            </button>
            <button
              type="button"
              data-ile-turn-insight-continue
              onClick={onContinue}
              disabled={!canFinish || busy !== null}
              className="border border-white bg-white px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue with the next turn
            </button>
          </footer>
        </div>
      </div>
    </DialogFrame>
  );
}
