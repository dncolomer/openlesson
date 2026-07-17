import fs from "node:fs/promises";
import path from "node:path";
import { aestheticImageForId, FALLBACK_AESTHETIC_IMAGES } from "@/lib/aesthetics";

const AESTHETICS_PREFIX = "/aesthetics/";

/** Absolute filesystem root for aesthetic assets (public/aesthetics). */
export function aestheticsDiskRoot(): string {
  return path.resolve(process.cwd(), "public", "aesthetics");
}

/**
 * True when every path segment is a safe filename piece (no `..`, empty, or
 * absolute segments). Used before any disk join of user/DB-influenced paths.
 * Decodes URI components so `%2e%2e` cannot bypass the `..` check.
 */
export function hasSafeAestheticsSegments(pathname: string): boolean {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (!decoded.startsWith(AESTHETICS_PREFIX)) return false;
  const rest = decoded.slice(AESTHETICS_PREFIX.length);
  if (!rest || rest.includes("\0")) return false;
  const segments = rest.split("/");
  if (segments.length === 0) return false;
  for (const segment of segments) {
    if (!segment || segment === "." || segment === "..") return false;
    // Reject Windows-style drive / absolute fragments and path separators in segment.
    if (segment.includes("\\") || path.isAbsolute(segment)) return false;
  }
  return true;
}

export function isAestheticsPublicPath(value: string): boolean {
  if (!value) return false;
  let pathname = value;
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      pathname = new URL(value).pathname;
    }
  } catch {
    return false;
  }
  return hasSafeAestheticsSegments(pathname);
}

/** Normalize to a site-relative `/aesthetics/...` path, or null if not aesthetics. */
export function toAestheticsPublicPath(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  let pathname = raw;
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      pathname = new URL(raw).pathname;
    }
  } catch {
    return null;
  }
  if (!hasSafeAestheticsSegments(pathname)) return null;
  // Normalize duplicate slashes without allowing escape.
  return pathname.replace(/\/+/g, "/");
}

/**
 * Resolve the background for an OG card. Prefer an aesthetics path when provided;
 * otherwise pick a stable aesthetic for `seed`. Always returns `/aesthetics/...`.
 */
export function resolveOgAestheticPath(options: {
  preferred?: string | null;
  seed: string;
  pool?: string[];
}): string {
  const preferred = toAestheticsPublicPath(options.preferred);
  if (preferred) return preferred;
  return aestheticImageForId(options.seed, options.pool ?? FALLBACK_AESTHETIC_IMAGES);
}

function mimeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

/**
 * Map a validated `/aesthetics/...` public path to an absolute disk path that
 * is guaranteed to stay under public/aesthetics (rejects `..` and other escapes).
 */
export function resolveAestheticDiskPath(publicPath: string): string {
  const relative = toAestheticsPublicPath(publicPath);
  if (!relative) {
    throw new Error(`OG aesthetic path must be under /aesthetics/: ${publicPath}`);
  }

  const root = aestheticsDiskRoot();
  const underRoot = relative.slice(AESTHETICS_PREFIX.length); // e.g. "lunar/foo.jpeg"
  const fullPath = path.resolve(root, underRoot);

  // Containment check: resolved path must be strictly inside (or equal to a file under) root.
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (fullPath !== root && !fullPath.startsWith(rootWithSep)) {
    throw new Error(`OG aesthetic path escapes aesthetics root: ${publicPath}`);
  }
  if (fullPath === root) {
    throw new Error(`OG aesthetic path must point to a file under /aesthetics/: ${publicPath}`);
  }

  return fullPath;
}

/**
 * Load an aesthetics public path from disk as a data URL so next/og does not
 * need to HTTP-fetch the asset (works offline, in CI, and on cold starts).
 *
 * Paths may come from DB-backed entity fields (cover_image_url, aesthetic_image);
 * they are constrained to public/aesthetics before any readFile.
 */
export async function loadAestheticDataUrl(publicPath: string): Promise<string> {
  const fullPath = resolveAestheticDiskPath(publicPath);
  const buf = await fs.readFile(fullPath);
  const mime = mimeForExt(path.extname(fullPath));
  return `data:${mime};base64,${buf.toString("base64")}`;
}
