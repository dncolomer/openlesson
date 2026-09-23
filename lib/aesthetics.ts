export const FALLBACK_AESTHETIC_IMAGES = [
  "/aesthetics/architecture/HHfAOzYWYAAhCDa.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
  "/aesthetics/galactic-stoneworks/HHjOxLWXMAEFcn0.jpeg",
  "/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg",
  "/aesthetics/piotr-binkowski/HGHQJOtWgAAOGtm.jpeg",
];

export interface AestheticPackage {
  id: string;
  name: string;
  images: string[];
  previewImage: string;
}

export const ORG_CUSTOM_AESTHETIC_PACKAGE_ID = "org-custom";

export type ActiveAestheticPool = {
  source: "custom" | "system";
  images: string[];
};

function normalizePoolUrls(value: readonly string[] | null | undefined): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const raw of value ?? []) {
    const url = String(raw || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

/**
 * Custom org stills replace the system pool entirely. An empty custom list
 * means system defaults (the caller supplies the folder listing).
 * Never concatenates custom URLs with /aesthetics/ paths.
 */
export function decideActiveAestheticPool(input: {
  customUrls?: readonly string[] | null;
  systemImages?: readonly string[] | null;
}): ActiveAestheticPool {
  const custom = normalizePoolUrls(input.customUrls);
  if (custom.length > 0) {
    return { source: "custom", images: custom };
  }
  return { source: "system", images: normalizePoolUrls(input.systemImages) };
}

/**
 * Images for a dock chip, map tile, or cover when the caller may not have a
 * pool yet. A provided or fetched list wins. FALLBACK_AESTHETIC_IMAGES is used
 * only after the org-aware listing has loaded and is empty (system defaults).
 * `pending` means the listing has not returned, so callers must not force the
 * folder stills over an already assigned custom URL.
 */
export function selectSurfaceAestheticImages(input: {
  provided?: readonly string[] | null;
  /** `undefined` = fetchAestheticPackages has not settled. */
  fromPackages?: readonly string[] | null;
}): {
  images: readonly string[];
  source: "provided" | "packages" | "fallback" | "pending";
} {
  const provided = normalizePoolUrls(input.provided);
  if (provided.length > 0) return { images: provided, source: "provided" };
  if (input.fromPackages === undefined) return { images: [], source: "pending" };
  const fetched = normalizePoolUrls(input.fromPackages);
  if (fetched.length > 0) return { images: fetched, source: "packages" };
  return { images: [...FALLBACK_AESTHETIC_IMAGES], source: "fallback" };
}

/** One package so existing clients use the custom set and no named-pack catalog. */
export function aestheticPackageFromCustomUrls(images: readonly string[]): AestheticPackage {
  const urls = normalizePoolUrls(images);
  return {
    id: ORG_CUSTOM_AESTHETIC_PACKAGE_ID,
    name: "Custom",
    images: urls,
    previewImage: urls[0] || "",
  };
}

/**
 * Pick a newly chosen workspace cover from the active pool.
 * System pools with no folder images fall through to FALLBACK_AESTHETIC_IMAGES.
 */
export function pickWorkspaceCoverFromPool(
  pool: ActiveAestheticPool,
  random: () => number = Math.random,
): string | null {
  const images =
    pool.images.length > 0
      ? pool.images
      : pool.source === "system"
        ? [...FALLBACK_AESTHETIC_IMAGES]
        : [];
  if (images.length === 0) return null;
  const index = Math.min(
    images.length - 1,
    Math.max(0, Math.floor(random() * images.length)),
  );
  return images[index] ?? null;
}

/** Assign distinct images to a fixed number of UI slots (cycles only if pool is smaller). */
export function aestheticImagesForSlots(count: number, images = FALLBACK_AESTHETIC_IMAGES) {
  const pool = images.length > 0 ? images : FALLBACK_AESTHETIC_IMAGES;
  const picks: string[] = [];
  for (let index = 0; index < count; index += 1) {
    let image = pool[index % pool.length];
    let offset = 0;
    while (picks.includes(image) && offset < pool.length) {
      offset += 1;
      image = pool[(index + offset) % pool.length];
    }
    picks.push(image);
  }
  return picks;
}

export function ileWorkAestheticStorageKey(sessionId: string): string {
  return `uncertain-systems:${sessionId}:work-aesthetics`;
}

export function parseIleWorkAestheticStored(
  raw: string | null | undefined,
): Record<string, string> | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const next: Record<string, string> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) next[id] = value.trim();
    }
    return next;
  } catch {
    return null;
  }
}

/** Chapter ids that share one still: plan tiles, open Work, and the map selection. */
export function ileChapterAestheticIds(input: {
  stepIds?: readonly (string | null | undefined)[] | null;
  openWorkIds?: readonly (string | null | undefined)[] | null;
  selectedId?: string | null;
}): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined) => {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  for (const id of input.stepIds ?? []) push(id);
  for (const id of input.openWorkIds ?? []) push(id);
  push(input.selectedId);
  return ids;
}

/**
 * Session-lived Work stills: keep an existing pick, assign a stable per-id
 * unused image for new ids so leave/return does not drop stills.
 * Bar preview, map tile, dock chip, and Work widget all read these picks.
 */
export function assignIleWorkAestheticImages(input: {
  ids: readonly string[] | null | undefined;
  current?: Record<string, string> | null;
  images?: readonly string[] | null;
  random?: () => number;
}): Record<string, string> {
  const ids = [
    ...new Set(
      (input.ids ?? [])
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    ),
  ];
  const explicitPool =
    input.images && input.images.length > 0 ? [...input.images] : null;
  const pool = explicitPool ?? [...FALLBACK_AESTHETIC_IMAGES];
  const next: Record<string, string> = {};
  for (const id of ids) {
    const existing = String(input.current?.[id] || "").trim();
    // A stored still outside the active pool (for example a /aesthetics/ pick
    // while the org set is custom) is not reused.
    if (existing && (!explicitPool || explicitPool.includes(existing))) {
      next[id] = existing;
    }
  }
  const used = new Set(Object.values(next));
  const random = input.random;
  for (const id of ids) {
    if (next[id]) continue;
    const unused = pool.filter((image) => !used.has(image));
    const source = unused.length > 0 ? unused : pool;
    const image = random
      ? source[
          Math.min(
            source.length - 1,
            Math.max(0, Math.floor(random() * source.length)),
          )
        ]
      : aestheticImageForId(id, source);
    next[id] = image ?? pool[0];
    used.add(next[id]);
  }
  return next;
}

/** Stable per-id pick — same image on server and client (no Math.random). */
export function aestheticImageForId(id: string, images: readonly string[] = FALLBACK_AESTHETIC_IMAGES) {
  if (images.length === 0) return FALLBACK_AESTHETIC_IMAGES[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return images[hash % images.length];
}

/** Dock chip, map tile, voice bar, and Work widget share this still for a chapter. */
export function resolveIleWorkAestheticImage(input: {
  id: string;
  assigned?: string | null;
  images?: readonly string[] | null;
}): string {
  const explicitPool =
    input.images && input.images.length > 0 ? [...input.images] : null;
  const pool = explicitPool ?? [...FALLBACK_AESTHETIC_IMAGES];
  const assigned = String(input.assigned || "").trim();
  if (assigned && (!explicitPool || explicitPool.includes(assigned))) return assigned;
  return aestheticImageForId(input.id, pool);
}

export function formatAestheticName(id: string) {
  return id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Folder-id vibe lines written from the pack stills (fallback is generated). */
export const AESTHETIC_PACKAGE_VIBES: Record<string, string> = {
  architecture:
    "A gilded sanctuary in the trees — teal domes, warm gold light, a palace grown into the forest.",
  "galactic-stoneworks":
    "Night-forest hideaway — moss, timber, and a single warm window in the blue dark.",
  "greco-futurism":
    "A classical future — marble colonnades, copper inlay, and sunlit cities under a new sky.",
  lunar:
    "Quiet lunar night — Earth on the horizon, glass domes, a cold industrial hush.",
  mars:
    "World-being-made — bronze lattice gardens, dust-lit halls, palms under an alien vault.",
  "piotr-binkowski":
    "Painterly sci-fi myth — colossal faces, overgrown ruins, gold light in impossible cities.",
};

export function aestheticPackageVibe(id: string): string {
  const key = String(id || "").trim().toLowerCase();
  if (key && AESTHETIC_PACKAGE_VIBES[key]) return AESTHETIC_PACKAGE_VIBES[key];
  const name = formatAestheticName(id || "this pack");
  return `${name} stills for this session — map, Work, and chrome share the same mood.`;
}

let inflightAestheticPackages: Promise<AestheticPackage[]> | null = null;

export async function fetchAestheticPackages(): Promise<AestheticPackage[]> {
  if (!inflightAestheticPackages) {
    inflightAestheticPackages = fetch("/api/aesthetics", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return [];
        const data = (await response.json()) as { packages?: AestheticPackage[] };
        return Array.isArray(data.packages) ? data.packages : [];
      })
      .catch(() => [])
      .finally(() => {
        inflightAestheticPackages = null;
      });
  }
  return inflightAestheticPackages;
}
