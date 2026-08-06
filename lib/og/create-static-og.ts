import {
  composeOgImageForSurfaceId,
  composeStandardOgImage,
  OG_CONTENT_TYPE,
  OG_SIZE,
} from "@/lib/og/compose";
import { standardShareAlt } from "@/lib/og/standard";
import { getOgSurface } from "@/lib/og/surfaces";

/**
 * Thin OG route factory. All static surfaces emit the same unsys standard card
 * (LP title/text + aesthetics). Surface id is validated against the registry only.
 *
 * ```ts
 * // app/pricing/opengraph-image.tsx
 * import { createStaticOgImageHandler, staticOgAlt, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/create-static-og";
 * export const alt = staticOgAlt("pricing");
 * export const size = OG_SIZE;
 * export const contentType = OG_CONTENT_TYPE;
 * export default createStaticOgImageHandler("pricing");
 * ```
 */
export function createStaticOgExports(surfaceId: string) {
  // Validate registry membership; alt/card always use the unsys standard.
  getOgSurface(surfaceId);
  return {
    alt: standardShareAlt(),
    size: OG_SIZE,
    contentType: OG_CONTENT_TYPE,
    default: async function Image() {
      return composeStandardOgImage();
    },
  };
}

/** Default export handler — always the unsys standard card. */
export function createStaticOgImageHandler(surfaceId: string) {
  getOgSurface(surfaceId);
  return async function Image() {
    return composeOgImageForSurfaceId(surfaceId);
  };
}

/** Alt text is always the unsys standard (surface id kept for call-site stability). */
export function staticOgAlt(_surfaceId?: string): string {
  void _surfaceId;
  return standardShareAlt();
}

export { OG_SIZE, OG_CONTENT_TYPE };
