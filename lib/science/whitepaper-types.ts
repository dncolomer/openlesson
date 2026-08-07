/**
 * Shared structural types for science white papers rendered by ScienceWhitepaperPage.
 */

export type WhitepaperSection = {
  id: string;
  heading: string;
  /** Optional kicker for methods framing */
  kicker?: string;
  paragraphs: string[];
  bullets?: string[];
  /** Nested subsections (e.g. experiment / study steps) */
  subsections?: Array<{
    id: string;
    heading: string;
    paragraphs: string[];
    bullets?: string[];
  }>;
};

export type WhitepaperExperimentStep = {
  id: string;
  title: string;
  summary: string;
};

export type WhitepaperMeta = {
  title: string;
  shortTitle: string;
  authors: string;
  version: string;
  status: string;
  date: string;
  description: string;
};

/** Generic science white paper shape consumed by the shared page renderer. */
export type ScienceWhitepaper = {
  path: string;
  meta: WhitepaperMeta;
  abstract: string;
  keywords: string[];
  sections: WhitepaperSection[];
  references: Array<{ id: string; citation: string }>;
  /** Optional step cards shown under a planned-experiment / planned-study section */
  experimentSteps?: readonly WhitepaperExperimentStep[];
};

/** Flatten all body text for term search / tests. */
export function getWhitepaperFullText(paper: ScienceWhitepaper): string {
  const parts: string[] = [
    paper.meta.title,
    paper.meta.description,
    paper.abstract,
    ...paper.keywords,
  ];
  for (const section of paper.sections) {
    parts.push(section.heading, ...(section.paragraphs ?? []), ...(section.bullets ?? []));
    for (const sub of section.subsections ?? []) {
      parts.push(sub.heading, ...(sub.paragraphs ?? []), ...(sub.bullets ?? []));
    }
  }
  for (const ref of paper.references) {
    parts.push(ref.citation);
  }
  for (const step of paper.experimentSteps ?? []) {
    parts.push(step.title, step.summary);
  }
  return parts.join("\n");
}

/** Planned experiment/study section text (for verification excerpts). */
export function getWhitepaperExperimentText(
  paper: ScienceWhitepaper,
  sectionIds: string[] = ["planned-experiment", "planned-study"],
): string {
  const section = paper.sections.find((s) => sectionIds.includes(s.id));
  if (!section) return "";
  const parts: string[] = [section.heading, ...section.paragraphs];
  for (const sub of section.subsections ?? []) {
    parts.push(sub.heading, ...sub.paragraphs, ...(sub.bullets ?? []));
  }
  for (const step of paper.experimentSteps ?? []) {
    parts.push(step.title, step.summary);
  }
  return parts.join("\n");
}
