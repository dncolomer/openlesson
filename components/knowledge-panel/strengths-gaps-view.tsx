"use client";

import { StrengthsGapsPanel } from "@/components/StrengthsGapsPanel";
import { useKnowledgeRanking } from "@/components/knowledge-panel/use-knowledge-ranking";
import type { KnowledgeRankingViewProps } from "@/components/knowledge-panel/types";

export function KnowledgeStrengthsGapsView({
  workspaceId,
  currentUserId = null,
  ayclToken,
  canInspectOthers,
}: KnowledgeRankingViewProps) {
  const { rankingCards, rankingLoading, rankingError, loadRanking } = useKnowledgeRanking({
    workspaceId,
    currentUserId,
    ayclToken,
    canInspectOthers,
  });

  return (
    <StrengthsGapsPanel
      cards={rankingCards}
      loading={rankingLoading}
      error={rankingError}
      onRefresh={() => void loadRanking()}
    />
  );
}
