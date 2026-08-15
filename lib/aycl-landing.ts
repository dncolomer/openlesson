/**
 * Pure helpers for public All-You-Can-Learn per-workspace landing pages:
 * catalog summary, view-only map nodes, buy CTA inputs, Explore/Learn samples.
 */

import {
  ayclOfferDescription,
  ayclOfferLabel,
  type AyclAccessTier,
} from "@/lib/aycl-shared";
import { shouldShowMapNotesPlaneToggle } from "@/lib/learner-map-notes";
import { shouldShowAnnotationLayerToggles } from "@/lib/map-annotation-layers";
import {
  formatAyclPriceCents,
  normalizeAyclListingFields,
  resolveAyclCheckoutCents,
  type AyclListingFields,
} from "@/lib/aycl-marketplace";
import type { SkillGridNode } from "@/lib/block-skill-grid";
import {
  buildGroundedDialogueQuestion,
  buildGroundedExerciseItem,
  isMetaLearningFluff,
  type PracticeItemContext,
} from "@/lib/practice-item-builders";
import {
  buildDomainExerciseAuthorSystemPrompt,
  isInventYourOwnExerciseMeta,
  isLowQualityTapbenchExercise,
} from "@/lib/pow-api/tapbench-exercise-quality";
import { buildTapOpeningQuestionTask } from "@/lib/prompt-kernel/surfaces/tap";
import { toSkillGridNodes } from "@/lib/skill-grid-positions";

export type AyclLandingBlockRow = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  is_start?: boolean | null;
  next_block_ids?: string[] | null;
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  shape_cells?: unknown;
};

export type AyclLandingWorkspaceRow = AyclListingFields & {
  id: string;
  title?: string | null;
  root_topic?: string | null;
  description?: string | null;
  workspace_goal?: string | null;
  notes?: string | null;
  cover_image_url?: string | null;
  is_all_you_can_learn?: boolean | null;
};

export type AyclLandingOffer = {
  tier: AyclAccessTier;
  label: string;
  description: string;
  priceCents: number;
  priceLabel: string;
};

export type AyclLandingSummary = {
  workspaceId: string;
  title: string;
  rootTopic: string | null;
  description: string | null;
  workspaceGoal: string | null;
  notes: string | null;
  coverImageUrl: string | null;
  summary: string;
  category: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  blockCount: number;
  offers: { learner: AyclLandingOffer; full: AyclLandingOffer };
  /** View-only map props for BlockSkillGrid */
  map: {
    viewOnly: true;
    canEdit: false;
    learnerMode: false;
    nodes: SkillGridNode[];
  };
  paths: {
    landingPath: string;
    listingPath: string;
    ogImagePath: string;
  };
};

function clean(s: unknown): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
}

/**
 * Workspace columns needed by assembleAyclLandingSummary (including marketplace listing).
 * Keep SSR page, OG image, and API routes in sync via this string.
 */
export const AYCL_LANDING_WORKSPACE_SELECT =
  "id, title, root_topic, description, workspace_goal, notes, cover_image_url, is_all_you_can_learn, aycl_category, aycl_summary, aycl_author_name, aycl_author_avatar_url, aycl_learner_price_cents, aycl_full_price_cents";

export function ayclLandingPath(workspaceId: string): string {
  const id = String(workspaceId || "").trim();
  return id ? `/all-you-can-learn/${id}` : "/all-you-can-learn";
}

/** Canonical share image for AYCL landings — always the unsys standard root card. */
export function ayclLandingOgImagePath(_workspaceId?: string): string {
  void _workspaceId;
  return "/opengraph-image";
}

/**
 * Assemble public landing payload from catalog workspace + blocks.
 * Only valid for is_all_you_can_learn workspaces (caller enforces).
 */
export function assembleAyclLandingSummary(input: {
  workspace: AyclLandingWorkspaceRow;
  blocks?: readonly AyclLandingBlockRow[] | null;
}): AyclLandingSummary {
  const ws = input.workspace;
  const id = String(ws.id || "").trim();
  const listing = normalizeAyclListingFields(ws);
  const title =
    clean(ws.title) || clean(ws.root_topic) || "All-You-Can-Learn workspace";
  const description = clean(ws.description) || null;
  const goal = clean(ws.workspace_goal) || null;
  const notes = clean(ws.notes) || null;
  const rootTopic = clean(ws.root_topic) || null;

  const summaryParts = [
    listing.summary,
    description,
    goal,
    notes,
  ].filter(Boolean) as string[];
  const summary =
    summaryParts[0] ||
    `A curated lifetime learning environment${rootTopic ? ` on ${rootTopic}` : ""}. Explore chapters, practice, and depth at your own pace.`;

  const nodes = toSkillGridNodes(
    (input.blocks || []).map((b) => ({
      id: b.id,
      title: clean(b.title) || "Block",
      status: b.status || "available",
      is_start: Boolean(b.is_start),
      next_block_ids: Array.isArray(b.next_block_ids) ? b.next_block_ids : [],
      description: clean(b.description) || undefined,
      position_x: b.position_x ?? null,
      position_y: b.position_y ?? null,
      span_w: b.span_w ?? null,
      span_h: b.span_h ?? null,
      shape_cells: b.shape_cells,
    })),
  );

  const learnerCents = resolveAyclCheckoutCents("learner", ws);
  const fullCents = resolveAyclCheckoutCents("full", ws);

  return {
    workspaceId: id,
    title,
    rootTopic,
    description,
    workspaceGoal: goal,
    notes,
    coverImageUrl: clean(ws.cover_image_url) || null,
    summary,
    category: listing.category,
    authorName: listing.authorName,
    authorAvatarUrl: listing.authorAvatarUrl,
    blockCount: nodes.length,
    offers: {
      learner: {
        tier: "learner",
        label: ayclOfferLabel("learner"),
        description: ayclOfferDescription("learner"),
        priceCents: learnerCents,
        priceLabel: formatAyclPriceCents(learnerCents),
      },
      full: {
        tier: "full",
        label: ayclOfferLabel("full"),
        description: ayclOfferDescription("full"),
        priceCents: fullCents,
        priceLabel: formatAyclPriceCents(fullCents),
      },
    },
    map: {
      viewOnly: true,
      canEdit: false,
      learnerMode: false,
      nodes,
    },
    paths: {
      landingPath: ayclLandingPath(id),
      listingPath: "/all-you-can-learn",
      ogImagePath: ayclLandingOgImagePath(id),
    },
  };
}

/**
 * Public map preview overlay chrome: toggles only for overlays that exist.
 * Does not invent notes or handwriting layers.
 */
export function resolveAyclPreviewOverlayChrome(input: {
  noteCount: number;
  layerCount: number;
}): {
  showNotesToggle: boolean;
  showLayerToggles: boolean;
  showStack: boolean;
} {
  const showNotesToggle = shouldShowMapNotesPlaneToggle(input.noteCount);
  const showLayerToggles = shouldShowAnnotationLayerToggles(input.layerCount);
  return {
    showNotesToggle,
    showLayerToggles,
    showStack: showNotesToggle || showLayerToggles,
  };
}

export function ayclMapPreviewFullscreenActive(open: unknown): boolean {
  return open === true || open === "true" || open === 1;
}

export function toggleAyclMapPreviewFullscreen(open: unknown): boolean {
  return !ayclMapPreviewFullscreenActive(open);
}

/** Stripe checkout body for AYCL purchase from the landing CTA. */
export function ayclLandingCheckoutBody(
  workspaceId: string,
  tier: AyclAccessTier = "full",
): {
  priceType: "all_you_can_learn";
  workspaceId: string;
  ayclAccessTier: AyclAccessTier;
} {
  return {
    priceType: "all_you_can_learn",
    workspaceId: String(workspaceId || "").trim(),
    ayclAccessTier: tier === "learner" ? "learner" : "full",
  };
}

export type AyclExploreLearnSamples = {
  questions: string[];
  exercises: string[];
};

export function ayclLandingPracticeContext(
  summary: Pick<
    AyclLandingSummary,
    "title" | "description" | "workspaceGoal" | "notes" | "rootTopic"
  >,
  blocks?: readonly AyclLandingBlockRow[] | null,
): PracticeItemContext {
  const first = (blocks || []).find((b) => clean(b.title) || clean(b.description));
  return {
    workspaceTitle: summary.title,
    rootTopic: summary.rootTopic,
    workspaceGoal: summary.workspaceGoal,
    workspaceDescription: summary.description,
    notes: summary.notes,
    blockTitle: first ? clean(first.title) || summary.title : summary.title,
    blockDescription:
      (first && clean(first.description)) ||
      summary.description ||
      summary.workspaceGoal ||
      null,
  };
}

/** Offline / failed-xAI fallback using shipped Explore/Drill builders. */
export function buildAyclExploreLearnFallback(
  ctx: PracticeItemContext,
  count = 3,
): AyclExploreLearnSamples {
  const n = Math.max(1, Math.min(6, Math.floor(count) || 3));
  const questions: string[] = [];
  const exercises: string[] = [];
  for (let i = 0; i < n; i++) {
    questions.push(buildGroundedDialogueQuestion(ctx, i));
    exercises.push(buildGroundedExerciseItem(ctx, i));
  }
  return { questions, exercises };
}

export function buildAyclExploreLearnSystemPrompt(): string {
  return [
    "You generate preview practice samples for a public All-You-Can-Learn landing page.",
    "Section title for the learner: “Things you'll Explore and Learn”.",
    "",
    "DIALOGUE / EXPLORATORY QUESTIONS — rules:",
    buildTapOpeningQuestionTask(),
    "",
    "SOLO EXERCISES — rules:",
    buildDomainExerciseAuthorSystemPrompt("tap_exercise"),
    "",
    "OUTPUT: JSON only:",
    '{ "questions": string[3], "exercises": string[3] }',
    "Exactly 3 exploratory questions and 3 exercises.",
    "Ground every item in the workspace goal and subject matter. No meta icebreakers, no core-mechanism wrappers, no invent-your-own exercises.",
  ].join("\n");
}

export function buildAyclExploreLearnUserPrompt(
  summary: AyclLandingSummary,
  blocks?: readonly AyclLandingBlockRow[] | null,
): string {
  const titles = (blocks || [])
    .map((b) => clean(b.title))
    .filter(Boolean)
    .slice(0, 12);
  return [
    `Workspace: ${summary.title}`,
    summary.rootTopic ? `Topic: ${summary.rootTopic}` : "",
    summary.workspaceGoal ? `Goal: ${summary.workspaceGoal}` : "",
    summary.description ? `Description: ${summary.description}` : "",
    summary.notes ? `Notes: ${summary.notes.slice(0, 400)}` : "",
    titles.length ? `Map blocks: ${titles.join(" · ")}` : "",
    "",
    "Generate 3 exploratory questions and 3 concrete exercises for this lifetime learning environment.",
    "Return JSON only.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Parse xAI JSON into questions + exercises; drop meta fluff; pad with fallbacks.
 */
/**
 * Parse xAI Explore/Learn samples. Returns model strings only — never pads with
 * pure grounded templates. Empty if payload is thin (caller should error).
 */
export function parseAyclExploreLearnSamples(
  raw: unknown,
  _ctx?: PracticeItemContext,
): AyclExploreLearnSamples {
  void _ctx;
  if (!raw || typeof raw !== "object") {
    return { questions: [], exercises: [] };
  }
  const rec = raw as Record<string, unknown>;

  const takeStrings = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    return v
      .map((item) => {
        if (typeof item === "string") return item.replace(/\s+/g, " ").trim();
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          const t = o.question || o.text || o.prompt;
          return typeof t === "string" ? t.replace(/\s+/g, " ").trim() : "";
        }
        return "";
      })
      .filter((s) => s.length >= 4);
  };

  return {
    questions: takeStrings(rec.questions).slice(0, 3),
    exercises: takeStrings(rec.exercises).slice(0, 3),
  };
}

/** Shared hackathon catalog (listing page + former AYCL tab). */
export const AYCL_HACKATHONS = [
  {
    id: "pc-hackathon",
    title: "Probabilistic Computing Hackathon",
    host: "ETH Zurich",
    date: "June 10, 2026",
    location: "Zurich, Switzerland",
    status: "Past event" as const,
    description:
      "A hands-on day on probabilistic and thermodynamic computing — Energy-Based Models, THRML, lectures, team builds, and demos. Winners and lifetime packages coming soon.",
    href: "/hackathons/probabilistic-computing",
    image:
      "https://cdn.sanity.io/images/otrk6k1t/production/7ef4d9c0fcf06719cb7ddd7ebdb20b02a2355793-1736x1284.webp?auto=format&fit=max&q=75&w=868",
  },
] as const;
