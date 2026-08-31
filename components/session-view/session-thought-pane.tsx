"use client";

import { SessionHeliosPanel } from "@/components/SessionHeliosPanel";
import type { HeliosTurnMode } from "@/components/thought-ui/ThoughtUi";
import type { AestheticPackage } from "@/lib/aesthetics";
import type { ExerciseDualLists } from "@/lib/ile-mode";
import type { ChapterFollowUpSuggestion } from "@/lib/ile-chapter-follow-ups";
import type { SpokenLocale } from "@/lib/tutoring-languages";
import type { SessionThoughtInterface } from "@/lib/useSessionThoughtInterface";
import type { PowParticipantIdentity } from "@/lib/session-participant-identity";
import type { IleWordBoxMenuAction } from "@/lib/ile-word-boxes";
import type { IleChapterHeliosActionsProps } from "@/components/session-view/ile-chapter-helios-actions";

export type SessionThoughtPaneProps = {
  activeChapterKey: string;
  chapterReloadNonce: number;
  isProjectMode: boolean;
  participantIdentity?: PowParticipantIdentity | null;
  lastUserTurn: { id: string; content: string } | null;
  lastAssistantTurn: { id: string; content: string } | null;
  isAssistantPending: boolean;
  heliosTurnMode: HeliosTurnMode;
  chapterPrompt: string;
  userInitial: string;
  isSessionActive: boolean;
  isInitializing: boolean;
  isChapterLoading: boolean;
  loadingChapterLabel: string | null;
  hasPlanSteps: boolean;
  sessionId: string;
  ttsLanguage: SpokenLocale;
  selectedAesthetic: AestheticPackage | undefined;
  thought: SessionThoughtInterface;
  chapterThoughtsLocked: boolean;
  projectStash: ExerciseDualLists["stash"];
  projectSolution: ExerciseDualLists["submitted"];
  chapterFollowUps: ChapterFollowUpSuggestion[];
  chapterFollowUpsLoading: boolean;
  chapterFollowUpsError: string | null;
  onSelectChapterFollowUp: (suggestion: ChapterFollowUpSuggestion) => void;
  onProjectStash: (providedText?: string) => void;
  onProjectSubmitToSolution: () => void;
  onOpenWordBoxTool?: (action: IleWordBoxMenuAction) => void;
  chapterActions?: IleChapterHeliosActionsProps | null;
  replica?: boolean;
};

export function SessionThoughtPane({
  activeChapterKey,
  chapterReloadNonce,
  isProjectMode,
  participantIdentity = null,
  lastUserTurn,
  lastAssistantTurn,
  isAssistantPending,
  heliosTurnMode,
  chapterPrompt,
  userInitial,
  isSessionActive,
  isInitializing,
  isChapterLoading,
  loadingChapterLabel,
  hasPlanSteps,
  sessionId,
  ttsLanguage,
  selectedAesthetic,
  thought,
  chapterThoughtsLocked,
  projectStash,
  projectSolution,
  chapterFollowUps,
  chapterFollowUpsLoading,
  chapterFollowUpsError,
  onSelectChapterFollowUp,
  onProjectStash,
  onProjectSubmitToSolution,
  onOpenWordBoxTool,
  chapterActions = null,
  replica = false,
}: SessionThoughtPaneProps) {
  return (
    <div className="relative h-full">
      <SessionHeliosPanel
        key={`${activeChapterKey}-${chapterReloadNonce}`}
        lastUserTurn={isProjectMode ? null : lastUserTurn}
        lastAssistantTurn={isProjectMode ? null : lastAssistantTurn}
        isAssistantPending={isProjectMode ? false : isAssistantPending}
        heliosTurnMode={isProjectMode ? "idle" : heliosTurnMode}
        chapterPrompt={chapterPrompt}
        userInitial={userInitial}
        isSessionActive={isSessionActive}
        isInitializing={isInitializing}
        isChapterLoading={isChapterLoading}
        loadingChapterLabel={loadingChapterLabel}
        hasPlanSteps={hasPlanSteps}
        sessionId={sessionId}
        ttsLanguage={ttsLanguage}
        aestheticImages={selectedAesthetic?.images}
        aestheticName={selectedAesthetic?.name}
        thought={thought}
        participantIdentity={participantIdentity}
        projectMode={isProjectMode}
        chapterThoughtsLocked={chapterThoughtsLocked}
        projectStash={projectStash}
        projectSolution={projectSolution}
        chapterFollowUps={chapterFollowUps}
        chapterFollowUpsLoading={chapterFollowUpsLoading}
        chapterFollowUpsError={chapterFollowUpsError}
        onSelectChapterFollowUp={onSelectChapterFollowUp}
        onProjectStash={onProjectStash}
        onProjectSubmitToSolution={onProjectSubmitToSolution}
        onOpenWordBoxTool={onOpenWordBoxTool}
        chapterActions={chapterActions}
        replica={replica}
      />
    </div>
  );
}
