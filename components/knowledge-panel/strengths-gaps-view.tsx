"use client";

import { StrengthsGapsPanel } from "@/components/StrengthsGapsPanel";
import { useKnowledgeRanking } from "@/components/knowledge-panel/use-knowledge-ranking";
import type { KnowledgeRankingViewProps } from "@/components/knowledge-panel/types";
import { VerificationFlowSubtabFilter } from "@/components/VerificationFlowSubtabFilter";
import { knowledgeRankingCardsForVerificationFlow } from "@/lib/verification-knowledge-subtab";

export function KnowledgeStrengthsGapsView({
  workspaceId,
  currentUserId = null,
  ayclToken,
  canInspectOthers,
  flowFilter,
}: KnowledgeRankingViewProps) {
  const { rankingCards, rankingLoading, rankingError, loadRanking } = useKnowledgeRanking({
    workspaceId,
    currentUserId,
    ayclToken,
    canInspectOthers,
  });
  const cards = knowledgeRankingCardsForVerificationFlow(
    rankingCards,
    flowFilter?.rows ?? [],
    flowFilter?.enabled ? flowFilter.flowId : null,
  );

  return (
    <div data-knowledge-subtab="strengths_gaps" className="flex min-h-0 flex-1 flex-col">
      <VerificationFlowSubtabFilter subtab="strengths_gaps" filter={flowFilter} />
      <StrengthsGapsPanel
        cards={cards}
        loading={rankingLoading}
        error={rankingError}
        onRefresh={() => void loadRanking()}
      />
    </div>
  );
}
