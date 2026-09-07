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

/**
 * Session-lived Work stills: keep an existing pick, assign a fresh unused
 * image for new ids. Reload drops React state so picks can change.
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
    const existing = input.current?.[id];
    if (existing) next[id] = existing;
  }
  const used = new Set(Object.values(next));
  const random = input.random ?? Math.random;
  for (const id of ids) {
    if (next[id]) continue;
    const unused = pool.filter((image) => !used.has(image));
    const source = unused.length > 0 ? unused : pool;
    const index = Math.min(
      source.length - 1,
      Math.max(0, Math.floor(random() * source.length)),
    );
    const image = source[index] ?? pool[0];
    next[id] = image;
    used.add(image);
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

export function formatAestheticName(id: string) {
  return id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function fetchAestheticPackages(): Promise<AestheticPackage[]> {
  const response = await fetch("/api/aesthetics", { cache: "no-store" });
  if (!response.ok) return [];
  const data = (await response.json()) as { packages?: AestheticPackage[] };
  return Array.isArray(data.packages) ? data.packages : [];
}
