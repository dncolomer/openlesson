/** Safe max lengths for OG card typography at 1200×630. */
export const OG_TITLE_MAX = 120;
export const OG_DESCRIPTION_MAX = 180;

/**
 * Truncate text for OG cards. Collapses whitespace and appends an ellipsis
 * when the cleaned string exceeds maxLength.
 */
export function truncateOgText(text: string, maxLength: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  if (maxLength <= 1) return "…";
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

export function truncateOgTitle(text: string, maxLength = OG_TITLE_MAX): string {
  return truncateOgText(text, maxLength);
}

export function truncateOgDescription(text: string, maxLength = OG_DESCRIPTION_MAX): string {
  return truncateOgText(text, maxLength);
}

/** Prefer the segment before `|` or ` - ` for card titles when meta titles include brand. */
export function shortTitleFromMeta(metaTitle: string): string {
  const pipe = metaTitle.split("|")[0]?.trim();
  if (pipe && pipe.length > 0 && pipe.length < metaTitle.length) return pipe;
  const dash = metaTitle.split(" - ")[0]?.trim();
  if (dash && dash.length > 0 && dash.length < metaTitle.length) return dash;
  return metaTitle.trim();
}
