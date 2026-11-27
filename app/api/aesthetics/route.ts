import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  aestheticPackageFromCustomUrls,
  decideActiveAestheticPool,
  formatAestheticName,
  type AestheticPackage,
} from "@/lib/aesthetics";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadOrgAesthetics } from "@/lib/organization/aesthetics-store";
import { resolveSidebarStyleForProtocol } from "@/lib/organization/protocol-settings-store";
import {
  EMPTY_SESSION_SIDEBAR_STYLE,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const AESTHETICS_DIR = path.join(process.cwd(), "public", "aesthetics");

/** Viewer's org set. Anonymous users and users with no org stay on system defaults. */
async function viewerOrgAesthetics(): Promise<{
  urls: string[];
  style: SessionSidebarStyle;
}> {
  const empty = { urls: [] as string[], style: EMPTY_SESSION_SIDEBAR_STYLE };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return empty;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.organization_id) return empty;

    const admin = createAdminClient();
    const loaded = await loadOrgAesthetics(admin, profile.organization_id);
    if (!loaded.ok) return empty;
    const style = await resolveSidebarStyleForProtocol(admin, profile.organization_id, null);
    return { urls: loaded.stored.urls, style };
  } catch {
    return empty;
  }
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export async function GET() {
  try {
    const org = await viewerOrgAesthetics();
    const decision = decideActiveAestheticPool({
      customUrls: org.urls,
      systemImages: [],
    });
    if (decision.source === "custom") {
      return NextResponse.json({
        packages: [aestheticPackageFromCustomUrls(decision.images)],
        source: "custom",
        sidebarStyle: org.style,
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

    return NextResponse.json({
      packages: packages.filter(Boolean),
      sidebarStyle: org.style,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ packages: [], sidebarStyle: EMPTY_SESSION_SIDEBAR_STYLE });
    }
    console.error("Failed to load aesthetics packages", error);
    return NextResponse.json({ packages: [] }, { status: 500 });
  }
}
