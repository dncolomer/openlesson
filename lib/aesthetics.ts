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
  const pool =
    input.images && input.images.length > 0
      ? [...input.images]
      : FALLBACK_AESTHETIC_IMAGES;
  const next: Record<string, string> = {};
  for (const id of ids) {
    const existing = String(input.current?.[id] || "").trim();
    if (existing) next[id] = existing;
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
export function aestheticImageForId(id: string, images = FALLBACK_AESTHETIC_IMAGES) {
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
  const pool =
    input.images && input.images.length > 0
      ? [...input.images]
      : FALLBACK_AESTHETIC_IMAGES;
  const assigned = String(input.assigned || "").trim();
  if (assigned) return assigned;
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

export async function fetchAestheticPackages(): Promise<AestheticPackage[]> {
  const response = await fetch("/api/aesthetics", { cache: "no-store" });
  if (!response.ok) return [];
  const data = (await response.json()) as { packages?: AestheticPackage[] };
  return Array.isArray(data.packages) ? data.packages : [];
}
