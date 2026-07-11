import fs from "fs/promises";
import path from "path";

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

export async function getRandomWorkspaceCoverImage(): Promise<string | null> {
  try {
    const images = await collectAestheticImages(AESTHETICS_DIR);
    if (images.length === 0) return null;
    return images[Math.floor(Math.random() * images.length)];
  } catch (error) {
    console.error("[plan-image] Failed to load aesthetic images:", error);
    return null;
  }
}

export async function generateAndStorePlanCover(
  supabase: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => { update: any };
  },
  _userId: string,
  workspaceId: string,
  _description: string
): Promise<string | null> {
  const coverUrl = await getRandomWorkspaceCoverImage();
  if (!coverUrl) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("workspaces") as any)
    .update({ cover_image_url: coverUrl })
    .eq("id", workspaceId);

  return coverUrl;
}
