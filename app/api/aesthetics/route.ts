import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { formatAestheticName, type AestheticPackage } from "@/lib/aesthetics";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const AESTHETICS_DIR = path.join(process.cwd(), "public", "aesthetics");

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export async function GET() {
  try {
    const entries = await readdir(AESTHETICS_DIR, { withFileTypes: true });
    const packages = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map(async (entry): Promise<AestheticPackage | null> => {
          const files = await readdir(path.join(AESTHETICS_DIR, entry.name), { withFileTypes: true });
          const images = files
            .filter((file) => file.isFile() && IMAGE_EXTENSIONS.has(path.extname(file.name).toLowerCase()))
            .map((file) => `/aesthetics/${entry.name}/${file.name}`)
            .sort();

          if (images.length === 0) return null;

          return {
            id: entry.name,
            name: formatAestheticName(entry.name),
            images,
            previewImage: randomItem(images),
          };
        }),
    );

    return NextResponse.json({ packages: packages.filter(Boolean) });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ packages: [] });
    }
    console.error("Failed to load aesthetics packages", error);
    return NextResponse.json({ packages: [] }, { status: 500 });
  }
}
