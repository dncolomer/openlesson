"use client";

import type { ReactNode } from "react";
import {
  SECTION_PANEL_BODY_CLASS,
  SECTION_SURFACE_CONTENT_CLASS,
  SECTION_SURFACE_GRADIENT_CLASS,
  SECTION_SURFACE_IMAGE_CLASS,
  SECTION_SURFACE_ROOT_CLASS,
  SECTION_SURFACE_SCRIM_CLASS,
  type SectionSurfaceKind,
  type WorkspaceSectionIdentity,
} from "@/lib/workspace-section-surface";
import { cn } from "@/lib/utils";

type WorkspaceSectionSurfaceProps = {
  kind: SectionSurfaceKind;
  imageSrc?: string | null;
  /** Kept for callers; identity chrome is no longer rendered (name is on section tabs). */
  identity: WorkspaceSectionIdentity;
  children: ReactNode;
  className?: string;
  /** Optional trailing controls above the body (e.g. actions). */
  headerActions?: ReactNode;
};

/**
 * Full-area Knowledge / Setting chrome: aesthetic bg + overlays.
 * Workspace name is shown on the top-level section tab bar, not here.
 * Body shell is identical for both kinds (compact tab panels own their padding).
 */
export function WorkspaceSectionSurface({
  kind,
  imageSrc,
  identity: _identity,
  children,
  className,
  headerActions,
}: WorkspaceSectionSurfaceProps) {
  return (
    <section
      className={cn(SECTION_SURFACE_ROOT_CLASS, className)}
      data-workspace-section-surface={kind}
    >
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt="" className={SECTION_SURFACE_IMAGE_CLASS} />
      ) : null}
      <div className={SECTION_SURFACE_SCRIM_CLASS} aria-hidden />
      <div className={SECTION_SURFACE_GRADIENT_CLASS} aria-hidden />

      <div className={SECTION_SURFACE_CONTENT_CLASS}>
        {headerActions ? (
          <div className="flex shrink-0 justify-end px-3 py-2 sm:px-4" data-section-header-actions>
            {headerActions}
          </div>
        ) : null}

        <div className={SECTION_PANEL_BODY_CLASS} data-section-body={kind}>
          {children}
        </div>
      </div>
    </section>
  );
}
