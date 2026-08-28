import type { AestheticPackage } from "@/lib/aesthetics";
import type { InitProgress } from "@/lib/local-inference";
import type { IleSessionMode } from "@/lib/ile-mode";
import type { InitialChaptersLevel } from "@/lib/initial-chapters";
import type { SessionPlan } from "@/lib/domain/types";
import type { SpokenLocale } from "@/lib/tutoring-languages";
import type { PowParticipantIdentity } from "@/lib/session-participant-identity";
import type {
  BlockLocalContextInput,
  PromptBlockInventoryItem,
  WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";

export type SessionViewTranslate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export type GuestAccessKind = "aycl" | "ile" | null;

export type ChapterPlanStatus = "unknown" | "empty" | "exists" | "failed";

export type PrepStage = "plan" | "model" | "done";

export type HelpPaneLayoutSnapshot = {
  leftWidth?: number;
  collapsedSide: null | "left" | "right";
};

export type HelpPreviousLayout = {
  outer: HelpPaneLayoutSnapshot;
  inner: HelpPaneLayoutSnapshot;
};

export type IlePromptMaterials = {
  workspaceId: string | null;
  workspaceTitle: string | null;
  workspaceGoal: string | null;
  rootTopic: string | null;
  notes: string | null;
  files: WorkspaceFileContextItem[];
  blocks: PromptBlockInventoryItem[];
  unusableCells: Array<{ row: number; col: number }>;
  focusedBlockId: string | null;
  blockTitle: string | null;
  blockDescription: string | null;
  blockLocalContext: BlockLocalContextInput | null;
};

export type SessionViewProps = {
  sessionId: string;
  ayclToken?: string;
  ileToken?: string;
  showEndSession?: boolean;
  entryQueryParams?: Record<string, string | string[]>;
  participantIdentity?: PowParticipantIdentity | null;
  sessionMode?: IleSessionMode | string;
};

export type SessionWelcomeModalProps = {
  t: SessionViewTranslate;
  languageConfirmed: boolean;
  planLoading: boolean;
  isPreparing: boolean;
  tutoringLanguage: SpokenLocale;
  onTutoringLanguageChange: (locale: SpokenLocale) => void;
  aestheticPackages: AestheticPackage[];
  selectedAesthetic: AestheticPackage | undefined;
  selectedAestheticId: string | null;
  onSelectAesthetic: (id: string) => void;
  aestheticsLoading: boolean;
  chapterPlanStatus: ChapterPlanStatus;
  regenerateChapters: boolean;
  onRegenerateChaptersChange: (next: boolean) => void;
  initialChapters: InitialChaptersLevel;
  onInitialChaptersChange: (level: InitialChaptersLevel) => void;
  autoAdvance: boolean;
  onToggleAutoAdvance: () => void;
  localInferenceEnabled: boolean;
  onToggleLocalInference: () => void;
  webGPUAvailable: boolean;
  planError: string | null;
  modelLoadError: string | null;
  modelLoadProgress: InitProgress | null;
  prepStage: PrepStage;
  onConfirmSettings: () => Promise<void> | void;
  onContinueWithoutInference: () => void;
  onReadyStart: () => Promise<void> | void;
  hasSessionPlan: boolean;
  sessionId?: string | null;
  sessionStartedAt?: string | null;
  sessionPlan?: SessionPlan | null;
  resumeSession?: boolean;
};
