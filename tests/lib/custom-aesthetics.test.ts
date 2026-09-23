/**
 * Org custom aesthetics: the uploaded set replaces the public/aesthetics pool,
 * and only an org admin can change that set.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aestheticPackageFromCustomUrls,
  assignIleWorkAestheticImages,
  decideActiveAestheticPool,
  FALLBACK_AESTHETIC_IMAGES,
  pickWorkspaceCoverFromPool,
  resolveIleWorkAestheticImage,
  selectSurfaceAestheticImages,
  ORG_CUSTOM_AESTHETIC_PACKAGE_ID,
} from "@/lib/aesthetics";
import {
  addCustomAestheticUrls,
  authorizeCustomAestheticEdit,
  readCustomAestheticUrls,
  removeCustomAestheticUrl,
} from "@/lib/organization/custom-aesthetic-set";
import {
  applyCustomAestheticUploads,
  validateCustomAestheticUpload,
  type CustomAestheticUpload,
} from "@/lib/organization/custom-aesthetics";
import { getRandomWorkspaceCoverImage } from "@/lib/workspace-image";
import {
  BACKGROUND_IMAGES,
  pickTapBackgroundImage,
} from "@/lib/tap-score-client-helpers";
import { resolveWorkspaceCoverImage } from "@/lib/workspace-visual";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function raster(bytes: Buffer, mimeType: string, fileName: string): CustomAestheticUpload {
  return { data: bytes.toString("base64"), mimeType, fileName };
}

/** 1×1 PNG. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Minimal JPEG (SOI + APP0 + EOI). */
const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

/** 1×1 GIF. */
const GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

/** RIFF/WEBP header the shipped sniffer accepts as WebP. */
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x04, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP"),
]);

function listSystemAestheticImages(): string[] {
  const root = join(ROOT, "public", "aesthetics");
  const images: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const dir = join(root, entry.name);
    for (const file of readdirSync(dir, { withFileTypes: true })) {
      if (!file.isFile()) continue;
      if (!/\.(jpe?g|png|webp|gif|avif)$/i.test(file.name)) continue;
      images.push(`/aesthetics/${entry.name}/${file.name}`);
    }
  }
  return images.sort();
}

describe("decideActiveAestheticPool", () => {
  const systemImages = listSystemAestheticImages();

  it("uses only the custom set, and system defaults when that set is empty", async () => {
    expect(systemImages.length).toBeGreaterThan(0);
    expect(systemImages.every((url) => url.startsWith("/aesthetics/"))).toBe(true);

    const customUrls = [
      "https://cdn.example/org/a.png",
      "https://cdn.example/org/b.webp",
      "https://cdn.example/org/c.gif",
    ];
    const custom = decideActiveAestheticPool({ customUrls, systemImages });
    expect(custom.source).toBe("custom");
    expect(custom.images).toEqual(customUrls);
    expect(custom.images.every((url) => customUrls.includes(url))).toBe(true);
    expect(custom.images.some((url) => url.startsWith("/aesthetics/"))).toBe(false);
    expect(custom.images.some((url) => systemImages.includes(url))).toBe(false);

    const pkg = aestheticPackageFromCustomUrls(custom.images);
    expect(pkg.images).toEqual(customUrls);
    expect(pkg.images.some((url) => url.startsWith("/aesthetics/"))).toBe(false);

    const empty = decideActiveAestheticPool({ customUrls: [], systemImages });
    expect(empty.source).toBe("system");
    expect(empty.images).toEqual(systemImages);

    const picked = pickWorkspaceCoverFromPool(empty, () => 0);
    expect(picked).toBeTruthy();
    expect(picked!.startsWith("/aesthetics/")).toBe(true);
    expect(systemImages).toContain(picked);
    expect(existsSync(join(ROOT, "public", picked!.replace(/^\//, "")))).toBe(true);

    const fallbackPick = pickWorkspaceCoverFromPool(
      decideActiveAestheticPool({ customUrls: null, systemImages: [] }),
      () => 0,
    );
    expect(FALLBACK_AESTHETIC_IMAGES).toContain(fallbackPick);

    const customCover = await getRandomWorkspaceCoverImage(customUrls);
    expect(customUrls).toContain(customCover);
    expect(String(customCover).startsWith("/aesthetics/")).toBe(false);

    const systemCover = await getRandomWorkspaceCoverImage([]);
    expect(String(systemCover).startsWith("/aesthetics/")).toBe(true);
    expect(existsSync(join(ROOT, "public", String(systemCover).replace(/^\//, "")))).toBe(true);

    const customCard = resolveWorkspaceCoverImage("workspace-new", null, customUrls);
    expect(customUrls).toContain(customCard);
    expect(customCard.startsWith("/aesthetics/")).toBe(false);
    expect(resolveWorkspaceCoverImage("workspace-new", "/already-stored.jpg", customUrls)).toBe(
      "/already-stored.jpg",
    );
    expect(resolveWorkspaceCoverImage("workspace-new").startsWith("/aesthetics/")).toBe(true);
  });

  it("does not reuse a stored /aesthetics/ still while the custom pool is active", () => {
    const customUrls = [
      "https://cdn.example/org/a.png",
      "https://cdn.example/org/b.webp",
    ];
    const pool = decideActiveAestheticPool({
      customUrls,
      systemImages: listSystemAestheticImages(),
    });
    const stored = "/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg";
    expect(pool.images).not.toContain(stored);

    const assigned = assignIleWorkAestheticImages({
      ids: ["chapter-1", "chapter-2"],
      current: { "chapter-1": stored, "chapter-2": customUrls[1] },
      images: pool.images,
    });
    expect(customUrls).toContain(assigned["chapter-1"]);
    expect(assigned["chapter-1"].startsWith("/aesthetics/")).toBe(false);
    expect(assigned["chapter-2"]).toBe(customUrls[1]);

    const resolved = resolveIleWorkAestheticImage({
      id: "chapter-1",
      assigned: stored,
      images: pool.images,
    });
    expect(customUrls).toContain(resolved);
    expect(resolved.startsWith("/aesthetics/")).toBe(false);
  });

  it("does not use the folder fallback while a custom listing is available", () => {
    const customUrls = ["https://cdn.example/org/a.png", "https://cdn.example/org/b.webp"];
    const provided = selectSurfaceAestheticImages({
      provided: customUrls,
      fromPackages: FALLBACK_AESTHETIC_IMAGES,
    });
    expect(provided.source).toBe("provided");
    expect(provided.images).toEqual(customUrls);
    expect(provided.images.some((url) => url.startsWith("/aesthetics/"))).toBe(false);

    const fetched = selectSurfaceAestheticImages({
      provided: [],
      fromPackages: customUrls,
    });
    expect(fetched.source).toBe("packages");
    expect(fetched.images).toEqual(customUrls);

    const waiting = selectSurfaceAestheticImages({ provided: [], fromPackages: undefined });
    expect(waiting.source).toBe("pending");
    expect(waiting.images).toEqual([]);

    const system = selectSurfaceAestheticImages({ provided: [], fromPackages: [] });
    expect(system.source).toBe("fallback");
    expect(system.images).toEqual([...FALLBACK_AESTHETIC_IMAGES]);
    expect(system.images.every((url) => url.startsWith("/aesthetics/"))).toBe(true);
  });
});

describe("pickTapBackgroundImage", () => {
  it("uses the org custom package and keeps the Greco system list when that set is empty", () => {
    const customUrls = ["https://cdn.example/org/tap-a.png", "https://cdn.example/org/tap-b.webp"];
    const customPick = pickTapBackgroundImage(
      [{ id: ORG_CUSTOM_AESTHETIC_PACKAGE_ID, images: customUrls }],
      () => 0,
    );
    expect(customUrls).toContain(customPick);
    expect(customPick.startsWith("/aesthetics/")).toBe(false);

    const systemPick = pickTapBackgroundImage(
      [
        {
          id: "Greco-futurism",
          images: ["/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg"],
        },
      ],
      () => 0,
    );
    expect(BACKGROUND_IMAGES).toContain(systemPick);
    expect(systemPick.startsWith("/aesthetics/")).toBe(true);

    const failed = pickTapBackgroundImage([], () => 0);
    expect(BACKGROUND_IMAGES).toContain(failed);
  });
});

describe("custom aesthetic uploads", () => {
  const orgId = "org-custom-1";

  it("accepts several rasters, rejects a non-image, and removes down to empty", () => {
    const start: string[] = [];
    expect(readCustomAestheticUrls(start)).toEqual([]);

    const added = applyCustomAestheticUploads({
      current: start,
      organizationId: orgId,
      uploads: [
        raster(PNG, "image/png", "one.png"),
        raster(JPEG, "image/jpeg", "two.jpg"),
        raster(GIF, "image/gif", "three.gif"),
        raster(WEBP, "image/webp", "four.webp"),
      ],
      publicBaseUrl: "https://cdn.example",
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.added).toHaveLength(4);
    expect(new Set(added.urls).size).toBe(4);
    expect(added.urls).toEqual(added.added.map((image) => image.url));
    expect(added.urls.every((url) => url.startsWith("https://cdn.example/"))).toBe(true);
    expect(added.urls.some((url) => url.startsWith("/aesthetics/"))).toBe(false);

    const pngOnly = validateCustomAestheticUpload(
      raster(PNG, "image/png", "one.png"),
      orgId,
    );
    expect(pngOnly.ok).toBe(true);

    const before = added.urls;
    const text = applyCustomAestheticUploads({
      current: before,
      organizationId: orgId,
      uploads: [
        raster(Buffer.from("this is not an image"), "text/plain", "notes.txt"),
      ],
    });
    expect(text.ok).toBe(false);
    if (text.ok) return;
    expect(text.status).toBe(400);
    expect(text.urls).toEqual(before);

    const fakePng = applyCustomAestheticUploads({
      current: before,
      organizationId: orgId,
      uploads: [raster(Buffer.from("not really a png"), "image/png", "fake.png")],
    });
    expect(fakePng.ok).toBe(false);
    if (fakePng.ok) return;
    expect(fakePng.urls).toEqual(before);
    expect(addCustomAestheticUrls(before, [])).toEqual(before);

    const one = applyCustomAestheticUploads({
      current: [],
      organizationId: orgId,
      uploads: [raster(PNG, "image/png", "only.png")],
    });
    expect(one.ok).toBe(true);
    if (!one.ok) return;
    expect(one.urls).toHaveLength(1);
    const emptied = removeCustomAestheticUrl(one.urls, one.urls[0]);
    expect(emptied).toEqual([]);

    let remaining = before;
    while (remaining.length > 0) {
      const next = removeCustomAestheticUrl(remaining, remaining[remaining.length - 1]);
      expect(next).toHaveLength(remaining.length - 1);
      remaining = next;
    }
    expect(remaining).toEqual([]);
  });

  it("refuses a profile that is not the org admin and allows an org admin", () => {
    const member = authorizeCustomAestheticEdit({
      organization_id: "org-custom-1",
      is_org_admin: false,
    });
    expect(member.ok).toBe(false);
    if (member.ok) return;
    expect(member.status).toBe(403);

    const noOrg = authorizeCustomAestheticEdit({
      organization_id: null,
      is_org_admin: true,
    });
    expect(noOrg.ok).toBe(false);

    const admin = authorizeCustomAestheticEdit({
      organization_id: "org-custom-1",
      is_org_admin: true,
    });
    expect(admin).toEqual({ ok: true, organizationId: "org-custom-1" });
  });
});

describe("custom aesthetic surfaces", () => {
  it("wires multi-upload and remove on the org admin surface to the mutation path", () => {
    const dashboard = read("components/OrganizationDashboardTab.tsx");
    expect(dashboard).toContain('data-org-custom-aesthetics');
    expect(dashboard).toContain('data-org-aesthetic-upload');
    expect(dashboard).toContain("multiple");
    expect(dashboard).toContain('accept="image/png,image/jpeg,image/webp,image/gif"');
    expect(dashboard).toContain('data-org-aesthetic-remove');
    expect(dashboard).toContain('fetch("/api/organization/aesthetics"');
    expect(dashboard).toContain('method: "POST"');
    expect(dashboard).toContain('method: "DELETE"');
    expect(dashboard).toContain("handleAestheticUpload");
    expect(dashboard).toContain("handleRemoveAesthetic");
    expect(dashboard).toContain("isOrgAdmin");

    const route = read("app/api/organization/aesthetics/route.ts");
    expect(route).toContain("authorizeCustomAestheticEdit");
    expect(route).toContain("applyCustomAestheticUploads");
    expect(route).toContain("removeCustomAestheticUrl");
    expect(route).toContain("addCustomAestheticUrls");

    const migration = read("supabase/migrations/20260923120000_organization_custom_aesthetics.sql");
    expect(migration).toContain("custom_aesthetic_urls");
    expect(migration).toContain("org-aesthetics");
  });

  it("WorkspaceView selects its image with selectSurfaceAestheticImages from the org-aware listing", () => {
    const workspace = read("components/WorkspaceView.tsx");
    expect(workspace).toContain("fetchAestheticPackages");
    expect(workspace).toContain("selectSurfaceAestheticImages");
    expect(workspace).toContain("aestheticImageForId(workspaceId, selection.images)");
    expect(workspace).not.toMatch(/aestheticImageForId\(workspaceId\)/);
    expect(workspace).not.toContain("public/aesthetics");
  });

  it("ile-turn-insight-craft uses useSurfaceAestheticImages and the folder fallback only when the listing is empty", () => {
    const craft = read("components/session-view/ile-turn-insight-craft.tsx");
    expect(craft).toContain("useSurfaceAestheticImages");
    expect(craft).toContain('surface.source === "fallback"');
    expect(craft).toContain("FALLBACK_AESTHETIC_IMAGES");
    expect(craft).not.toContain("public/aesthetics");
  });

  it("TAP backgrounds use pickTapBackgroundImage from the org-aware listing", () => {
    for (const rel of [
      "components/TapScoreClient.tsx",
      "components/ExerciseTapClient.tsx",
      "components/scout-tap/ScoutTapClient.tsx",
    ]) {
      const source = read(rel);
      expect(source).toContain("fetchAestheticPackages");
      expect(source).toContain("pickTapBackgroundImage");
      expect(source).not.toContain("BACKGROUND_IMAGES[");
    }
  });

  it("takes session, workspace, and skill-grid images from the org-aware aesthetics source", () => {
    const sessionChrome = read("components/session-view/use-session-chrome.ts");
    const workspace = read("components/WorkspaceView.tsx");
    const skillGrid = read("components/BlockSkillGrid.tsx");
    const sessionView = read("components/SessionView.tsx");
    const aestheticsApi = read("app/api/aesthetics/route.ts");
    const covers = read("lib/workspace-image.ts");

    for (const source of [sessionChrome, workspace, skillGrid]) {
      expect(source).toContain("fetchAestheticPackages");
      expect(source).not.toContain("public/aesthetics");
    }

    const dock = read("components/session-view/ile-work-dock-bar.tsx");
    const map = read("components/block-skill-grid/map-world-layer.tsx");
    const craft = read("components/session-view/ile-turn-insight-craft.tsx");
    expect(workspace).toContain("selectSurfaceAestheticImages");
    expect(workspace).toContain("aestheticImageForId(workspaceId, selection.images)");
    expect(workspace).not.toMatch(/aestheticImageForId\(workspaceId\)/);
    expect(craft).toContain("useSurfaceAestheticImages");
    expect(craft).toContain('surface.source === "fallback"');
    expect(dock).toContain("useSurfaceAestheticImages");
    expect(dock).toContain('surface.source === "fallback"');
    expect(dock).toContain("FALLBACK_AESTHETIC_IMAGES");
    expect(map).toContain("useSurfaceAestheticImages");
    expect(map).not.toContain("FALLBACK_AESTHETIC_IMAGES");
    expect(map).not.toContain("public/aesthetics");

    expect(sessionView).toContain("assignIleWorkAestheticImages");
    expect(sessionView).toContain("chromeSelectedAesthetic?.images");
    expect(sessionView).not.toContain("public/aesthetics");

    expect(aestheticsApi).toContain("decideActiveAestheticPool");
    expect(aestheticsApi).toContain("aestheticPackageFromCustomUrls");
    expect(aestheticsApi).toContain('path.join(process.cwd(), "public", "aesthetics")');
    expect(aestheticsApi).toContain('decision.source === "custom"');

    expect(covers).toContain("decideActiveAestheticPool");
    expect(covers).toContain("pickWorkspaceCoverFromPool");

    const dashboard = read("app/dashboard/page.tsx");
    const card = read("components/WorkspaceDashboardCard.tsx");
    expect(dashboard).toContain("fetchAestheticPackages");
    expect(dashboard).toContain("imagePool={workspaceCoverPool}");
    expect(card).toContain("imagePool={imagePool}");
    expect(card).not.toContain("public/aesthetics");
    // No new control that chooses a named pack versus the custom set.
    expect(covers).not.toContain("Greco-futurism");
    expect(sessionChrome).toContain("selectedAestheticId");
    expect(read("components/AestheticPicker.tsx")).not.toContain("custom versus");
    expect(read("components/OrganizationDashboardTab.tsx")).not.toContain("Greco-futurism");
  });
});
