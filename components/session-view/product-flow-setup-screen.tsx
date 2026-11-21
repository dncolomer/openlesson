"use client";

import { SessionWelcomeModal } from "@/components/session-view/session-welcome-modal";
import type { AestheticPackage } from "@/lib/aesthetics";
import type { SpokenLocale } from "@/lib/tutoring-languages";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Public Solve / Verification / Calibration start: language, Start Session.
 * The chosen aesthetic (random, or the org custom set) is the right-side image.
 * Same shell as Solve (`SessionWelcomeModal`). Duration is not chosen here.
 */
export function ProductFlowSetupScreen({
  t,
  title,
  tutoringLanguage,
  onTutoringLanguageChange,
  aestheticPackages,
  selectedAesthetic,
  selectedAestheticId,
  onSelectAesthetic,
  aestheticsLoading,
  isPreparing,
  planError = null,
  onConfirm,
  onBackToWorkspace,
}: {
  t: Translate;
  title: string;
  tutoringLanguage: SpokenLocale;
  onTutoringLanguageChange: (locale: SpokenLocale) => void;
  aestheticPackages: AestheticPackage[];
  selectedAesthetic: AestheticPackage | undefined;
  selectedAestheticId: string | null;
  onSelectAesthetic: (id: string) => void;
  aestheticsLoading: boolean;
  isPreparing: boolean;
  planError?: string | null;
  onConfirm: () => void;
  onBackToWorkspace?: () => void;
}) {
  return (
    <div data-product-flow-setup="" className="h-screen min-h-0 w-full">
      <SessionWelcomeModal
        t={t}
        title={title}
        languageConfirmed={false}
        planLoading={false}
        isPreparing={isPreparing}
        tutoringLanguage={tutoringLanguage}
        onTutoringLanguageChange={onTutoringLanguageChange}
        aestheticPackages={aestheticPackages}
        selectedAesthetic={selectedAesthetic}
        selectedAestheticId={selectedAestheticId}
        onSelectAesthetic={onSelectAesthetic}
        aestheticsLoading={aestheticsLoading}
        chapterPlanStatus="exists"
        autoAdvance={false}
        onToggleAutoAdvance={() => {}}
        planError={planError}
        onConfirmSettings={onConfirm}
        onBackToWorkspace={onBackToWorkspace}
        onReadyStart={() => {}}
        hasSessionPlan={false}
      />
    </div>
  );
}
