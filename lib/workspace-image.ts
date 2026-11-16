import fs from "fs/promises";
import path from "path";
import {
  decideActiveAestheticPool,
  FALLBACK_AESTHETIC_IMAGES,
  pickWorkspaceCoverFromPool,
} from "@/lib/aesthetics";

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
    console.error("[workspace-image] Failed to load aesthetic images:", error);
    const system = decideActiveAestheticPool({
      customUrls: [],
      systemImages: [...FALLBACK_AESTHETIC_IMAGES],
    });
    return pickWorkspaceCoverFromPool(system);
  }
}
