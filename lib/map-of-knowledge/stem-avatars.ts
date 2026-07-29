/**
 * Pregenerated STEM mini-avatar catalog for Map of Knowledge guest identity
 * and user markers. Pure helpers — no React / WebGL.
 */

export type StemMiniAvatarId =
  | "atom"
  | "rocket"
  | "dna"
  | "chip"
  | "flask"
  | "constellation"
  | "microscope"
  | "satellite"
  | "gear"
  | "lightning"
  | "binary"
  | "magnet";

export type StemMiniAvatar = {
  /** Stable catalog id */
  id: StemMiniAvatarId;
  /** Human label for tooltips / a11y */
  label: string;
  /** Public path to pregenerated asset */
  path: string;
  /** Short STEM theme tag */
  theme: string;
};

/** Public base path for mini avatar assets. */
export const STEM_MINI_AVATAR_BASE_PATH = "/map-avatars";

/**
 * Curated STEM mini set (circular badge SVGs under public/map-avatars/).
 * Order is stable — pick by index via seed.
 */
export const STEM_MINI_AVATARS: readonly StemMiniAvatar[] = [
  {
    id: "atom",
    label: "Atom",
    path: `${STEM_MINI_AVATAR_BASE_PATH}/atom.svg`,
    theme: "physics",
  },
  {
    id: "rocket",
    label: "Rocket",
    path: `${STEM_MINI_AVATAR_BASE_PATH}/rocket.svg`,
    theme: "aerospace",
  },
  {
    id: "dna",
    label: "DNA",
    path: `${STEM_MINI_AVATAR_BASE_PATH}/dna.svg`,
    theme: "biology",
  },
  {
    id: "chip",
    label: "Chip",
    path: `${STEM_MINI_AVATAR_BASE_PATH}/chip.svg`,
    theme: "computing",
  },
  {
    id: "flask",
    label: "Flask",
    path: `${STEM_MINI_AVATAR_BASE_PATH}/flask.svg`,
    theme: "chemistry",
  },
  {
    id: "constellation",
    label: "Constellation",
    path: `${STEM_MINI_AVATAR_BASE_PATH}/constellation.svg`,
    theme: "astronomy",
  },
  {
    id: "microscope",
    label: "Microscope",
    path: `${STEM_MINI_AVATAR_BASE_PATH}/microscope.svg`,
    theme: "lab",
  },
  {
    id: "satellite",
    label: "Satellite",
    path: `${STEM_MINI_AVATAR_BASE_PATH}/satellite.svg`,
    theme: "space",
  },
  {
    id: "gear",
    label: "Gear",
    path: `${STEM_MINI_AVATAR_BASE_PATH}/gear.svg`,
    theme: "engineering",
  },
  {
    id: "lightning",
    label: "Lightning",
    path: `${STEM_MINI_AVATAR_BASE_PATH}/lightning.svg`,
    theme: "energy",
  },
  {
    id: "binary",
    label: "Binary",
    path: `${STEM_MINI_AVATAR_BASE_PATH}/binary.svg`,
    theme: "cs",
  },
  {
    id: "magnet",
    label: "Magnet",
    path: `${STEM_MINI_AVATAR_BASE_PATH}/magnet.svg`,
    theme: "physics",
  },
] as const;

const BY_ID = new Map(STEM_MINI_AVATARS.map((a) => [a.id, a]));

/** Catalog size — must stay > 1 for variety. */
export function stemMiniAvatarCatalogSize(): number {
  return STEM_MINI_AVATARS.length;
}

export function isStemMiniAvatarId(value: unknown): value is StemMiniAvatarId {
  return typeof value === "string" && BY_ID.has(value as StemMiniAvatarId);
}

export function getStemMiniAvatar(id: string | null | undefined): StemMiniAvatar | null {
  if (!id) return null;
  return BY_ID.get(id as StemMiniAvatarId) ?? null;
}

export function stemMiniAvatarPath(id: string | null | undefined): string | null {
  return getStemMiniAvatar(id)?.path ?? null;
}

/**
 * FNV-1a style hash → unsigned 32-bit seed for deterministic picks from strings.
 */
export function hashStringToSeed(input: string): number {
  let h = 2166136261;
  const s = String(input || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Seedable catalog pick. Same seed → same avatar; different seeds can differ.
 * When seed is omitted, uses non-deterministic Math.random().
 */
export function pickStemMiniAvatar(seed?: number): StemMiniAvatar {
  const catalog = STEM_MINI_AVATARS;
  if (catalog.length === 0) {
    throw new Error("STEM mini avatar catalog is empty");
  }
  const n =
    typeof seed === "number" && Number.isFinite(seed)
      ? Math.abs(Math.floor(seed))
      : Math.floor(Math.random() * 1e9);
  return catalog[n % catalog.length];
}

/** Stable avatar for a subject / location id (legacy map points without stored avatar). */
export function stemMiniAvatarForSubjectId(id: string): StemMiniAvatar {
  return pickStemMiniAvatar(hashStringToSeed(id));
}

/**
 * Resolve avatar for a map user location: explicit avatar_id, else deterministic from id.
 */
export function resolveMapUserAvatar(input: {
  id: string;
  avatar_id?: string | null;
}): StemMiniAvatar {
  const fromId = getStemMiniAvatar(input.avatar_id);
  if (fromId) return fromId;
  return stemMiniAvatarForSubjectId(input.id);
}
