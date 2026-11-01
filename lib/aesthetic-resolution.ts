/**
 * Home Featured heroes are full-width (22–32rem). Twitter-crop stills in
 * public/aesthetics (~900×1200 and smaller) look soft there. Featured
 * surfaces use this high-res subset only. Map tiles keep the full pool.
 */

export const FEATURED_AESTHETIC_MIN_LONG_EDGE = 1600;
export const FEATURED_AESTHETIC_MIN_SHORT_EDGE = 800;

/** System stills that meet the Featured size bar. Keep in sync with public/aesthetics. */
export const HIGH_RESOLUTION_SYSTEM_AESTHETIC_IMAGES = [
  "/aesthetics/Greco-futurism/HH_tnSba0AAGxOF.jpeg",
  "/aesthetics/Greco-futurism/HH_toqAbwAAKiMu.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/galactic-stoneworks/HH-rSf2bUAAy30f.jpeg",
  "/aesthetics/galactic-stoneworks/HH611QUbYAAOvrQ.jpeg",
  "/aesthetics/galactic-stoneworks/HH_oB2CbYAA_g2r.jpeg",
  "/aesthetics/galactic-stoneworks/HHfsZ58W4AAcVHT.jpeg",
  "/aesthetics/galactic-stoneworks/HHj-HSaXgAUK9UV.jpeg",
  "/aesthetics/galactic-stoneworks/HHjOxLWXMAEFcn0.jpeg",
  "/aesthetics/galactic-stoneworks/HICAGgcaMAAKHXr.jpeg",
  "/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg",
  "/aesthetics/mars/HDLXgM_WYAAV6NC.jpeg",
  "/aesthetics/piotr-binkowski/HF4WSpPWIAAe0iD.jpeg",
  "/aesthetics/piotr-binkowski/HFvnuvVbQAA2SDn.jpeg",
  "/aesthetics/piotr-binkowski/HGDMJJrW4AA7PJn.jpeg",
  "/aesthetics/piotr-binkowski/HGEyY6eXYAEG6n5.jpeg",
] as const;

export const FEATURED_FALLBACK_AESTHETIC_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
  "/aesthetics/galactic-stoneworks/HHjOxLWXMAEFcn0.jpeg",
  "/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg",
  "/aesthetics/mars/HDLXgM_WYAAV6NC.jpeg",
  "/aesthetics/piotr-binkowski/HF4WSpPWIAAe0iD.jpeg",
] as const;

const HIGH_RESOLUTION_SYSTEM_AESTHETIC_SET = new Set<string>(
  HIGH_RESOLUTION_SYSTEM_AESTHETIC_IMAGES,
);

export function isHighResolutionAestheticSize(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  if (width < 1 || height < 1) return false;
  return (
    Math.max(width, height) >= FEATURED_AESTHETIC_MIN_LONG_EDGE &&
    Math.min(width, height) >= FEATURED_AESTHETIC_MIN_SHORT_EDGE
  );
}

/** Pathname under /aesthetics/…, or null when the URL is a custom/uploaded cover. */
export function systemAestheticPath(url: string | null | undefined): string | null {
  const trimmed = String(url || "").trim();
  if (!trimmed) return null;
  const withoutQuery = trimmed.split("#")[0].split("?")[0];
  if (withoutQuery.startsWith("/aesthetics/")) return withoutQuery;
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith("/aesthetics/")) return parsed.pathname;
  } catch {
    return null;
  }
  return null;
}

export function isHighResolutionSystemAestheticUrl(url: string | null | undefined): boolean {
  const path = systemAestheticPath(url);
  return Boolean(path && HIGH_RESOLUTION_SYSTEM_AESTHETIC_SET.has(path));
}

/**
 * Pool for Home Featured (hero + featured remainder). System Twitter-crops
 * are dropped. A custom org set (non-/aesthetics/ URLs) is kept as-is.
 */
export function filterFeaturedAestheticPool(
  pool?: readonly string[] | null,
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const raw of pool ?? []) {
    const url = String(raw || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  const custom = urls.filter((url) => !systemAestheticPath(url));
  if (custom.length > 0) return custom;

  const highRes = urls.filter((url) => isHighResolutionSystemAestheticUrl(url));
  return highRes.length > 0 ? highRes : [...FEATURED_FALLBACK_AESTHETIC_IMAGES];
}

/**
 * Stored cover for a Featured card. Low-res /aesthetics/ stills are ignored
 * so the high-res pool can fill the large hero.
 */
export function featuredStoredCoverUrl(
  coverImageUrl?: string | null,
): string | null {
  const stored = String(coverImageUrl || "").trim();
  if (!stored) return null;
  const path = systemAestheticPath(stored);
  if (!path) return stored;
  return isHighResolutionSystemAestheticUrl(path) ? stored : null;
}

export function readRasterDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  return readJpegDimensions(bytes) ?? readPngDimensions(bytes);
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    let marker = bytes[offset + 1];
    while (marker === 0xff && offset + 2 < bytes.length) {
      offset += 1;
      marker = bytes[offset + 1];
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (offset + 8 >= bytes.length) return null;
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (segmentLength < 2) return null;
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      if (width < 1 || height < 1) return null;
      return { width, height };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < png.length; i += 1) {
    if (bytes[i] !== png[i]) return null;
  }
  const width =
    (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height =
    (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  if (width < 1 || height < 1) return null;
  return { width, height };
}
