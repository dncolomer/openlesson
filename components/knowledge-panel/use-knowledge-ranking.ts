"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveModelsTabScope } from "@/lib/pow-api/models-tab-scope";
import {
  buildKnowledgeRanking,
  type KnowledgeRankingCard,
  type KnowledgeRankingRunLike,
} from "@/lib/pow-api/knowledge-ranking";
import {
  normalizePerformanceReport,
  type PerformanceReport,
} from "@/lib/pow-api/performance-report";
import {
  subjectOptionLabel,
  type AvailableSubject,
} from "@/components/knowledge-panel/widgets";
import {
  fetchKnowledgeConfig,
  mergeAvailableSubjects,
} from "@/components/knowledge-panel/knowledge-config-client";

export function useKnowledgeRanking(input: {
  workspaceId: string;
  currentUserId?: string | null;
  ayclToken?: string;
  canInspectOthers: boolean;
}) {
  const { workspaceId, currentUserId = null, ayclToken, canInspectOthers } = input;

  const [availableSubjects, setAvailableSubjects] = useState<AvailableSubject[]>([]);
  const [rankingRuns, setRankingRuns] = useState<KnowledgeRankingRunLike[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [selectedRankingKey, setSelectedRankingKey] = useState<string | null>(null);

  const loadRanking = useCallback(async () => {
    setRankingLoading(true);
    setRankingError(null);
    try {
      try {
        const payload = await fetchKnowledgeConfig(
          workspaceId,
          ayclToken,
          resolveModelsTabScope({
            mode: "user",
            currentUserId,
            targetUserId: currentUserId,
            targetGuestUserId: null,
            canInspectOthers,
          }).query,
        );
        setAvailableSubjects((prev) => mergeAvailableSubjects(prev, payload));
      } catch {
        // Ranking / Strengths & Gaps can still use history subjects alone.
      }

      const params = new URLSearchParams({
        workspaceId,
        limit: "500",
        vertical: "verification",
      });
      if (ayclToken) params.set("ayclToken", ayclToken);
      if (!canInspectOthers && currentUserId) {
        params.set("user_id", currentUserId);
      }

      const response = await fetch(`/api/workspace/snapshot-history?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to load ranking snapshots",
        );
      }
      const runs = (Array.isArray(data.runs) ? data.runs : []).map(
        (r: Record<string, unknown>) =>
          ({
            id: String(r.id || ""),
            ran_at: String(r.ran_at || r.created_at || ""),
            score:
              r.score == null
                ? null
                : typeof r.score === "number"
                  ? r.score
                  : Number(r.score),
            ghc_score:
              r.ghc_score == null
                ? null
                : typeof r.ghc_score === "number"
                  ? r.ghc_score
                  : Number(r.ghc_score),
            subject_user_id:
              typeof r.subject_user_id === "string" ? r.subject_user_id : null,
            subject_guest_user_id:
              typeof r.subject_guest_user_id === "string"
                ? r.subject_guest_user_id
                : null,
            vertical: typeof r.vertical === "string" ? r.vertical : "verification",
            report: r.report && typeof r.report === "object" ? r.report : null,
          }) satisfies KnowledgeRankingRunLike,
      );
      setRankingRuns(runs);
    } catch (err) {
      setRankingRuns([]);
      setRankingError(err instanceof Error ? err.message : "Failed to load ranking");
    } finally {
      setRankingLoading(false);
    }
  }, [ayclToken, canInspectOthers, currentUserId, workspaceId]);

  useEffect(() => {
    void loadRanking();
  }, [loadRanking]);

  const rankingCards: KnowledgeRankingCard[] = useMemo(() => {
    const subjects = availableSubjects.map((s) => ({
      user_id: s.user_id,
      guest_user_id: s.guest_user_id,
      label: subjectOptionLabel(s, currentUserId),
    }));
    return buildKnowledgeRanking({
      subjects,
      runs: rankingRuns,
      currentUserId,
    });
  }, [availableSubjects, currentUserId, rankingRuns]);

  useEffect(() => {
    if (rankingCards.length === 0) {
      setSelectedRankingKey(null);
      return;
    }
    setSelectedRankingKey((prev) => {
      if (prev && rankingCards.some((c) => c.subjectKey === prev)) return prev;
      return rankingCards[0].subjectKey;
    });
  }, [rankingCards]);

  const selectedRankingCard = useMemo(() => {
    if (!selectedRankingKey) return rankingCards[0] ?? null;
    return rankingCards.find((c) => c.subjectKey === selectedRankingKey) ?? rankingCards[0] ?? null;
  }, [rankingCards, selectedRankingKey]);

  const selectedRankingReport = useMemo((): PerformanceReport | null => {
    if (!selectedRankingCard?.report) return null;
    try {
      return normalizePerformanceReport(selectedRankingCard.report as PerformanceReport);
    } catch {
      return null;
    }
  }, [selectedRankingCard]);

  return {
    rankingCards,
    rankingLoading,
    rankingError,
    selectedRankingKey,
    setSelectedRankingKey,
    selectedRankingCard,
    selectedRankingReport,
    loadRanking,
  };
}
