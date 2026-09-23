import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  aestheticPackageFromCustomUrls,
  decideActiveAestheticPool,
  formatAestheticName,
  type AestheticPackage,
} from "@/lib/aesthetics";
import { readCustomAestheticUrls } from "@/lib/organization/custom-aesthetic-set";
import { createClient } from "@/lib/supabase/server";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const AESTHETICS_DIR = path.join(process.cwd(), "public", "aesthetics");

/** Viewer's org set. Anonymous users and users with no org stay on system defaults. */
async function viewerCustomAestheticUrls(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.organization_id) return [];

    const { data: org, error } = await supabase
      .from("organizations")
      .select("custom_aesthetic_urls")
      .eq("id", profile.organization_id)
      .maybeSingle();
    if (error || !org) return [];
    return readCustomAestheticUrls(org.custom_aesthetic_urls);
  } catch {
    return [];
  }
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export async function GET() {
  try {
    const customUrls = await viewerCustomAestheticUrls();
    const decision = decideActiveAestheticPool({
      customUrls,
      systemImages: [],
    });
    if (decision.source === "custom") {
      return NextResponse.json({
        packages: [aestheticPackageFromCustomUrls(decision.images)],
        source: "custom",
      });
    }

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
