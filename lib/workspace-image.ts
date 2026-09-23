import fs from "fs/promises";
import path from "path";
import {
  decideActiveAestheticPool,
  FALLBACK_AESTHETIC_IMAGES,
  pickWorkspaceCoverFromPool,
} from "@/lib/aesthetics";
import { readCustomAestheticUrls } from "@/lib/organization/custom-aesthetic-set";

const AESTHETICS_DIR = path.join(process.cwd(), "public", "aesthetics");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

async function collectAestheticImages(dir: string, base = ""): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const images = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(base, entry.name);
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return collectAestheticImages(fullPath, relativePath);
      }

      if (!entry.isFile() || !IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        return [];
      }

      return [`/aesthetics/${relativePath.split(path.sep).join("/")}`];
    })
  );

  return images.flat();
}

type CoverLookupClient = {
  from: (table: string) => {
    update?: (values: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<unknown> };
    select?: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data?: { organization_id?: string | null; custom_aesthetic_urls?: unknown } | null }>;
      };
    };
  };
};

async function customUrlsForCoverUser(
  supabase: CoverLookupClient,
  userId: string,
): Promise<string[]> {
  try {
    const profileQuery = supabase.from("profiles").select?.("organization_id");
    if (!profileQuery) return [];
    const { data: profile } = await profileQuery.eq("id", userId).maybeSingle();
    const organizationId = profile?.organization_id;
    if (!organizationId) return [];
    const orgQuery = supabase.from("organizations").select?.("custom_aesthetic_urls");
    if (!orgQuery) return [];
    const { data: org } = await orgQuery.eq("id", organizationId).maybeSingle();
    return readCustomAestheticUrls(org?.custom_aesthetic_urls);
  } catch {
    return [];
  }
}

export async function getRandomWorkspaceCoverImage(
  customUrls?: readonly string[] | null,
): Promise<string | null> {
  const customDecision = decideActiveAestheticPool({
    customUrls,
    systemImages: [],
  });
  if (customDecision.source === "custom") {
    return pickWorkspaceCoverFromPool(customDecision);
  }
  try {
    const images = await collectAestheticImages(AESTHETICS_DIR);
    const system = decideActiveAestheticPool({
      customUrls: [],
      systemImages: images.length > 0 ? images : [...FALLBACK_AESTHETIC_IMAGES],
    });
    return pickWorkspaceCoverFromPool(system);
  } catch (error) {
    console.error("[plan-image] Failed to load aesthetic images:", error);
    const system = decideActiveAestheticPool({
      customUrls: [],
      systemImages: [...FALLBACK_AESTHETIC_IMAGES],
    });
    return pickWorkspaceCoverFromPool(system);
  }
}

export async function generateAndStorePlanCover(
  supabase: CoverLookupClient,
  userId: string,
  workspaceId: string,
  _description: string,
  customUrls?: readonly string[] | null,
): Promise<string | null> {
  const urls = customUrls ?? (await customUrlsForCoverUser(supabase, userId));
  const coverUrl = await getRandomWorkspaceCoverImage(urls);
  if (!coverUrl) return null;

   
  await (supabase.from("workspaces") as any)
    .update({ cover_image_url: coverUrl })
    .eq("id", workspaceId);

  return coverUrl;
}
