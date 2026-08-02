import { aestheticImageForId } from "@/lib/aesthetics";

/** Stable bg image for Knowledge / Setting full-section chrome. */
export function resolveSectionSurfaceImage(
  workspaceId: string,
  images?: string[],
): string {
  return aestheticImageForId(workspaceId, images);
}

/** Root section host: fills remaining shell height with clipped aesthetic layer. */
export const SECTION_SURFACE_ROOT_CLASS =
  "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#080808]";

/** Dark scrim so text stays readable over aesthetic photos. */
export const SECTION_SURFACE_SCRIM_CLASS = "absolute inset-0 bg-black/35";

/** Vertical gradient matching Workspace column chrome. */
export const SECTION_SURFACE_GRADIENT_CLASS =
  "absolute inset-0 bg-gradient-to-b from-black/70 via-black/25 to-black/80";

/** Bg image treatment (same spirit as Workspace builder column). */
export const SECTION_SURFACE_IMAGE_CLASS =
  "absolute inset-0 h-full w-full object-cover opacity-35 saturate-75";

/** Content layer above bg. */
export const SECTION_SURFACE_CONTENT_CLASS =
  "relative z-10 flex min-h-0 flex-1 flex-col";

/** Identity header strip using real workspace fields. */
export const SECTION_SURFACE_HEADER_CLASS =
  "shrink-0 border-b border-white/5 bg-black/35 px-4 py-3 backdrop-blur-md sm:px-6";

/**
 * Shared shell body for Knowledge and Settings: fill remaining height, no outer
 * padding (tab strip is edge-to-edge; panels apply compact content padding).
 */
export const SECTION_PANEL_BODY_CLASS =
  "flex min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden";

/** @deprecated Prefer SECTION_PANEL_BODY_CLASS — Settings uses the same compact shell. */
export const SETTING_BODY_LAYOUT_CLASS = SECTION_PANEL_BODY_CLASS;

/** Knowledge body fills the surface (same shell as Settings). */
export const KNOWLEDGE_BODY_LAYOUT_CLASS = SECTION_PANEL_BODY_CLASS;

/**
 * Compact tab body under the shared sub-tab strip (Knowledge + Settings).
 * Matches Knowledge density: p-3 / sm:p-4, full width.
 */
export const SECTION_TAB_CONTENT_CLASS =
  "flex min-h-0 w-full max-w-none flex-1 flex-col overflow-y-auto p-3 sm:p-4";

/** Full-width stack for Settings tab panels (compact, same as Knowledge content pad). */
export const SETTING_INNER_LAYOUT_CLASS =
  "w-full max-w-none space-y-4";

export type SectionSurfaceKind = "knowledge" | "settings";

export type WorkspaceSectionIdentity = {
  title: string;
  topic?: string | null;
  description?: string | null;
  notes?: string | null;
  workspaceId: string;
  isOwner?: boolean;
};

/**
 * Pure: which identity fields to show in section chrome from real plan state.
 * Tests drive this helper — do not re-implement in tests.
 */
export function resolveSectionIdentityDisplay(
  identity: WorkspaceSectionIdentity,
  kind: SectionSurfaceKind,
): {
  eyebrow: string;
  title: string;
  subtitle: string | null;
  showOwnerBadge: boolean;
  notesPreview: string | null;
  topic: string | null;
} {
  const title = identity.title.trim() || identity.topic?.trim() || "Workspace";
  const topic =
    identity.topic?.trim() && identity.topic.trim() !== title
      ? identity.topic.trim()
      : null;
  const description = identity.description?.trim() || null;
  const notes = identity.notes?.trim() || null;
  const notesPreview =
    notes && notes.length > 160 ? `${notes.slice(0, 157)}…` : notes;

  return {
    eyebrow: kind === "knowledge" ? "Knowledge" : "Settings",
    title,
    subtitle: description,
    showOwnerBadge: identity.isOwner === true,
    notesPreview: kind === "settings" ? notesPreview : null,
    topic,
  };
}
