import { composeOgImageForSurfaceId, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/compose";
import { getOgSurface } from "@/lib/og/surfaces";

/**
 * Thin OG route factory: register copy in `lib/og/surfaces.ts`, then:
 *
 * ```ts
 * // app/pricing/opengraph-image.tsx
 * import { createStaticOgExports } from "@/lib/og/create-static-og";
 * export const { alt, size, contentType, default: defaultExport } = createStaticOgExports("pricing");
 * export default defaultExport;
 * ```
 *
 * Prefer the explicit named exports form below for Next.js file conventions.
 */
export function createStaticOgExports(surfaceId: string) {
  const surface = getOgSurface(surfaceId);
  return {
    alt: `${surface.brand ?? "Uncertain Systems"} — ${surface.title}`,
    size: OG_SIZE,
    contentType: OG_CONTENT_TYPE,
    default: async function Image() {
      return composeOgImageForSurfaceId(surfaceId);
    },
  };
}

/** Default export handler for a registered static surface. */
export function createStaticOgImageHandler(surfaceId: string) {
  return async function Image() {
    return composeOgImageForSurfaceId(surfaceId);
  };
}

export function staticOgAlt(surfaceId: string): string {
  const surface = getOgSurface(surfaceId);
  return `${surface.brand ?? "Uncertain Systems"} — ${surface.title}`;
}

export { OG_SIZE, OG_CONTENT_TYPE };
