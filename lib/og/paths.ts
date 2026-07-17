/**
 * Metadata image URL helpers (no surface registry imports — safe for SEO modules).
 * Composed OG cards are served by Next at `{path}/opengraph-image`.
 */

export function openGraphImagePathForRoute(routePath: string): string {
  if (!routePath || routePath === "/") return "/opengraph-image";
  const normalized = routePath.endsWith("/") ? routePath.slice(0, -1) : routePath;
  return `${normalized}/opengraph-image`;
}

export function openGraphImagesForRoutePath(routePath: string, alt: string) {
  return [
    {
      url: openGraphImagePathForRoute(routePath),
      width: 1200,
      height: 630,
      alt,
    },
  ];
}
