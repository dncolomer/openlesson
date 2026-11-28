/**
 * Org custom aesthetics: the uploaded set replaces the public/aesthetics pool,
 * and only an org admin can change that set.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readDashboardSurface } from "../helpers/surface-source";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aestheticPackageFromCustomUrls,
  assignIleWorkAestheticImages,
  decideActiveAestheticPool,
  FALLBACK_AESTHETIC_IMAGES,
  pickRandomAestheticPackage,
  pickWorkspaceCoverFromPool,
  resolveIleWorkAestheticImage,
  selectSurfaceAestheticImages,
  sessionTopicCardStill,
  ORG_CUSTOM_AESTHETIC_PACKAGE_ID,
} from "@/lib/aesthetics";
import { SessionTopicCard } from "@/components/session-view/learn-work-dock-bar";
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
import {
  BACKGROUND_IMAGES,
  pickTapBackgroundImage,
} from "@/lib/tap-score-client-helpers";
import { CustomAestheticsStyler } from "@/components/organization/custom-aesthetics-styler";
import { protocolSettingsPreviewScene } from "@/lib/organization/protocol-settings-preview";
import { sidebarStyleUserContent } from "@/lib/organization/sidebar-style-generate";
import {
  DEFAULT_SESSION_CANVAS_STYLE,
  EMPTY_SESSION_SIDEBAR_STYLE,
  invertSessionCanvasColor,
  isMissingSidebarStyleColumn,
  parseSessionCanvasStyle,
  parseSessionSidebarStyle,
  sessionCanvasExcalidrawChrome,
  sessionCanvasHex6,
  sessionSidebarPreviewStill,
  sidebarStyleImagePrompt,
  sessionSidebarStyleCssVars,
} from "@/lib/session-sidebar-style";
import { generateXaiImage } from "@/lib/xai-image";
import { IMAGINE_IMAGE_MODEL } from "@/lib/xai-models";

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

describe("session sidebar style", () => {
  it("keeps MAGI defaults and only accepts real colors", () => {
    const parsed = parseSessionSidebarStyle({
      prompt: "brass on ink",
      tokens: { background: "#120800", border: "rgba(255,200,80,0.4)", text: "lime", accent: "#f4e1b0" },
    });
    expect(parsed.prompt).toBe("brass on ink");
    expect(parsed.tokens.background).toBe("#120800");
    expect(parsed.tokens.border).toBe("rgba(255,200,80,0.4)");
    expect(parsed.tokens.accent).toBe("#f4e1b0");
    expect(parsed.tokens.text).toBe("#ffffff");
    expect(sessionSidebarStyleCssVars(parsed)["--session-sidebar-bg"]).toBe("#120800");
    expect(sessionSidebarStyleCssVars(parsed)["--session-sidebar-wash"]).toBeUndefined();
    expect(sidebarStyleImagePrompt({ prompt: "brass on ink", assetCount: 2 })).toContain("brass on ink");
    expect(sidebarStyleImagePrompt({ prompt: "brass on ink", assetCount: 2 })).toContain("16rem");
    expect(
      sessionSidebarStyleCssVars({
        ...parsed,
        backgroundImage: "https://cdn.example/sidebar.jpg",
      })["--session-sidebar-wash"],
    ).toBe("url(https://cdn.example/sidebar.jpg)");
    expect(
      sessionSidebarPreviewStill(EMPTY_SESSION_SIDEBAR_STYLE, [
        "https://cdn.example/a.png",
        "https://cdn.example/b.webp",
      ]),
    ).toBe("https://cdn.example/b.webp");
    expect(
      sessionSidebarPreviewStill(
        { ...EMPTY_SESSION_SIDEBAR_STYLE, backgroundImage: "https://cdn.example/sidebar.jpg" },
        ["https://cdn.example/a.png"],
      ),
    ).toBe("https://cdn.example/sidebar.jpg");
    expect(parsed.canvas).toEqual(DEFAULT_SESSION_CANVAS_STYLE);
    expect(parseSessionCanvasStyle({ background: "#112233", stroke: "#abcdef", zenMode: false })).toEqual({
      background: "#112233",
      stroke: "#abcdef",
      zenMode: false,
      gridMode: true,
    });
    expect(
      parseSessionCanvasStyle({
        background: "#112233",
        stroke: "#abcdef",
        zenMode: false,
        gridMode: false,
      }).gridMode,
    ).toBe(false);
    expect(
      parseSessionSidebarStyle({
        canvas: {},
        canvasBackground: "#224466",
        canvasStroke: "#ffcc00",
      }).canvas,
    ).toEqual({
      background: "#224466",
      stroke: "#ffcc00",
      zenMode: true,
      gridMode: true,
    });
    expect(sessionCanvasHex6("#0a0")).toBe("#00aa00");
    expect(invertSessionCanvasColor("#1e1e1e")).toBe("#e1e1e1");
    expect(invertSessionCanvasColor("#e1e1e1")).toBe("#1e1e1e");
    expect(invertSessionCanvasColor(invertSessionCanvasColor("#0a0a0a"))).toBe("#0a0a0a");
    expect(sessionCanvasExcalidrawChrome(DEFAULT_SESSION_CANVAS_STYLE).currentItemStrokeColor).toBe(
      "#1e1e1e",
    );
    expect(sessionCanvasExcalidrawChrome(DEFAULT_SESSION_CANVAS_STYLE).zenModeEnabled).toBe(true);
    expect(sessionCanvasExcalidrawChrome({ background: "#112233", stroke: "#ffffff", zenMode: false })).toEqual({
      viewBackgroundColor: invertSessionCanvasColor("#112233"),
      currentItemStrokeColor: invertSessionCanvasColor("#ffffff"),
      zenModeEnabled: false,
      gridModeEnabled: true,
    });
    expect(
      sessionCanvasExcalidrawChrome({
        background: "#112233",
        stroke: "#ffffff",
        zenMode: false,
        gridMode: false,
      }).gridModeEnabled,
    ).toBe(false);
  });

  it("sends the prompt and uploaded assets to xAI, and falls back when Imagine has no prompt", async () => {
    const content = sidebarStyleUserContent({
      prompt: "brass on ink",
      assetUrls: ["https://cdn.example/a.png", "https://cdn.example/b.webp"],
    });
    expect(content[0]).toEqual({
      type: "text",
      text: expect.stringContaining("brass on ink"),
    });
    expect((content[0] as { text: string }).text).toContain("Data panel");
    expect((content[0] as { text: string }).text).toContain("canvasBackground");
    expect(read("lib/organization/sidebar-style-generate.ts")).toContain("zenMode");
    expect(read("lib/organization/sidebar-style-generate.ts")).toContain("Data console");
    expect(content).toContainEqual({
      type: "image_url",
      image_url: { url: "https://cdn.example/a.png" },
    });
    expect(content).toHaveLength(3);
    expect(isMissingSidebarStyleColumn({ message: "column sidebar_style does not exist" })).toBe(
      true,
    );
    expect(isMissingSidebarStyleColumn({ message: "custom_aesthetic_urls missing" })).toBe(false);
    expect(read("lib/xai-image.ts")).toContain("IMAGINE_IMAGE_MODEL");
    expect(read("lib/xai-models.ts")).toContain(`IMAGINE_IMAGE_MODEL = "${IMAGINE_IMAGE_MODEL}"`);
    expect(read("lib/xai-image.ts")).toContain("/images/generations");
    expect(read("lib/xai-image.ts")).toContain("/images/edits");
    await expect(generateXaiImage("")).resolves.toEqual({
      ok: false,
      error: "Image prompt is required",
    });
  });

  it("renders a live session rail and work board instead of a dummy preview", () => {
    const html = renderToStaticMarkup(
      createElement(CustomAestheticsStyler, {
        urls: ["https://cdn.example/a.png"],
        style: parseSessionSidebarStyle({
          prompt: "brass on ink",
          backgroundImage: "https://cdn.example/sidebar.jpg",
          tokens: { background: "#120800", accent: "#f4e1b0" },
        }),
        prompt: "brass on ink",
        onPromptChange: () => {},
        uploading: false,
        generating: false,
        removingUrl: null,
        onUpload: () => {},
        onRemove: () => {},
        onGenerate: () => {},
        onReset: () => {},
        labels: {
          kicker: "Custom aesthetics",
          title: "Canvas sidebar styler",
          helper: "Upload assets, then prompt the look of the 16rem session rail.",
          prompt: "Style prompt",
          promptPlaceholder: "Brass on ink",
          apply: "Style sidebar",
          applying: "Styling…",
          reset: "Reset style",
          upload: "Upload assets",
          uploading: "Uploading…",
          empty: "No assets",
          remove: "Remove",
          removing: "Removing…",
          canvas: "Work canvas",
          canvasHelper: "Board fill",
          canvasBackground: "Background",
          canvasStroke: "Stroke",
          canvasZen: "Zen mode by default",
          canvasGrid: "Grid by default",
        },
      }),
    );
    expect(html).toContain("data-org-custom-aesthetics");
    expect(html).toContain("data-org-canvas-background");
    expect(html).toContain("data-org-canvas-stroke");
    expect(html).toContain("data-org-canvas-zen");
    expect(html).toContain("data-org-canvas-grid");
    expect(html).not.toContain("data-org-protocol-settings-preview");
    expect(html).not.toContain("data-session-work-surface");
    expect(html).toContain("data-org-sidebar-style-prompt");
    expect(html).toContain("data-org-sidebar-style-apply");
    expect(html).toContain("data-org-sidebar-style-reset");
    expect(html).toContain("data-org-aesthetic-upload");
    expect(html).toContain("Canvas sidebar styler");
    expect(html).toContain("https://cdn.example/a.png");
    expect(html).not.toContain("data-org-canvas-preview");
    const editor = read("components/organization/protocol-settings-editor.tsx");
    expect(editor).toContain("data-org-protocol-settings-editor");
    expect(editor).toContain("ProtocolSettingsCanvasMock");
    expect(editor).toContain("data-org-protocol-settings-preview-frame");
    expect(editor).toContain("CustomAestheticsStyler");
    expect(editor).not.toContain("SessionSidebar");
    const mock = read("components/organization/protocol-settings-canvas-mock.tsx");
    expect(mock).toContain("ExcalidrawCanvas");
    expect(mock).toContain("liveCanvasChrome");
    expect(mock).toContain("protocolSettingsPreviewScene");
    expect(mock).toContain("SessionWorkSurface");
    expect(mock).toContain("SessionGuidePanel");
    expect(mock).toContain("inertCommands");
    const scene = protocolSettingsPreviewScene();
    expect(scene.elements.length).toBeGreaterThan(0);
    expect(
      scene.elements.filter((el) => el.customData?.boardInstructionNote === "body"),
    ).toHaveLength(1);
    expect(scene.appState).toBeTruthy();
    expect(mock).not.toContain("data-session-topic-card-title");
    const uploadedOnly = renderToStaticMarkup(
      createElement(CustomAestheticsStyler, {
        urls: ["https://cdn.example/a.png", "https://cdn.example/b.webp"],
        style: EMPTY_SESSION_SIDEBAR_STYLE,
        prompt: "",
        onPromptChange: () => {},
        uploading: false,
        generating: false,
        removingUrl: null,
        onUpload: () => {},
        onRemove: () => {},
        onGenerate: () => {},
        onReset: () => {},
        labels: {
          kicker: "Custom aesthetics",
          title: "Canvas sidebar styler",
          helper: "helper",
          prompt: "Style prompt",
          promptPlaceholder: "Brass on ink",
          apply: "Style sidebar",
          applying: "Styling…",
          reset: "Reset style",
          upload: "Upload assets",
          uploading: "Uploading…",
          empty: "No assets",
          remove: "Remove",
          removing: "Removing…",
          canvas: "Work canvas",
          canvasHelper: "Board fill",
          canvasBackground: "Background",
          canvasStroke: "Stroke",
          canvasZen: "Zen mode by default",
          canvasGrid: "Grid by default",
        },
      }),
    );
    expect(uploadedOnly).toContain("https://cdn.example/b.webp");
    const compactRail = renderToStaticMarkup(
      createElement(CustomAestheticsStyler, {
        compact: true,
        urls: ["https://cdn.example/a.png", "https://cdn.example/b.webp"],
        style: EMPTY_SESSION_SIDEBAR_STYLE,
        prompt: "brass on ink",
        onPromptChange: () => {},
        uploading: false,
        generating: false,
        removingUrl: null,
        onUpload: () => {},
        onRemove: () => {},
        onGenerate: () => {},
        onReset: () => {},
        labels: {
          kicker: "Custom aesthetics",
          title: "Canvas sidebar styler",
          helper: "helper",
          prompt: "Style prompt",
          promptPlaceholder: "Brass on ink",
          apply: "Generate",
          applying: "Generating…",
          reset: "Reset style",
          upload: "Upload image",
          uploading: "Uploading…",
          empty: "No assets",
          remove: "Remove",
          removing: "Removing…",
          canvas: "Work canvas",
          canvasHelper: "Board fill",
          canvasBackground: "Background",
          canvasStroke: "Stroke",
          canvasZen: "Zen mode by default",
          canvasGrid: "Grid by default",
        },
      }),
    );
    expect(compactRail).toContain("data-org-aesthetic-upload");
    expect(compactRail).toContain("Upload image");
    expect(compactRail).toContain("Generate");
    expect(compactRail).toContain("aria-label=\"Generate\"");
    expect(compactRail).toContain("h-8 w-8");
    expect(compactRail).not.toContain("data-org-custom-aesthetics-assets");
    expect(compactRail).not.toContain("https://cdn.example/a.png");
    expect(compactRail).not.toContain("data-org-sidebar-style-reset");
  });
});

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
    expect(pickRandomAestheticPackage([pkg], () => 0)?.previewImage).toBe(customUrls[0]);
    expect(pickRandomAestheticPackage([pkg], () => 0.99)?.previewImage).toBe(
      customUrls[customUrls.length - 1],
    );
    expect(pickRandomAestheticPackage([pkg], () => 0.99)?.id).toBe(ORG_CUSTOM_AESTHETIC_PACKAGE_ID);

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

  it("paints the topic card from the custom set only, or from system stills when that set is empty", () => {
    const customUrls = ["https://cdn.example/org/a.png", "https://cdn.example/org/b.webp"];
    const systemImages = ["/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg"];
    const storedSystem = "/aesthetics/architecture/HHfAOzYWYAAhCDa.jpeg";
    const customStill = sessionTopicCardStill({
      id: "chapter-1",
      assigned: storedSystem,
      customUrls,
      systemImages,
    });
    expect(customUrls).toContain(customStill);
    expect(customStill.startsWith("/aesthetics/")).toBe(false);
    expect(systemImages).not.toContain(customStill);

    const customHtml = renderToStaticMarkup(
      createElement(SessionTopicCard, {
        id: "chapter-1",
        title: "Just war",
        image: storedSystem,
        customUrls,
        systemImages,
      }),
    );
    expect(customHtml).toContain(customStill);
    expect(customHtml).toContain('aria-label="Just war"');
    expect(customHtml).not.toContain("data-session-topic-card-title");
    expect(customHtml).not.toContain(storedSystem);
    expect(customHtml).not.toContain(systemImages[0]);
    expect(customHtml.match(/data-session-topic-card-image/g)).toHaveLength(1);

    const systemStill = sessionTopicCardStill({
      id: "chapter-1",
      assigned: storedSystem,
      customUrls: [],
      systemImages,
    });
    expect(systemStill).toBe(systemImages[0]);
    expect(customUrls).not.toContain(systemStill);

    const systemHtml = renderToStaticMarkup(
      createElement(SessionTopicCard, {
        id: "chapter-1",
        title: "Just war",
        image: storedSystem,
        customUrls: [],
        systemImages,
      }),
    );
    expect(systemHtml).toContain(systemStill);
    expect(systemHtml).not.toContain(customUrls[0]);
    expect(systemHtml).not.toContain("https://cdn.example/org/");
  });

  it("keeps a pinned uploaded still on the protocol settings topic card", () => {
    const uploaded = "https://cdn.example/org/brand.jpg";
    expect(
      sessionTopicCardStill({
        id: "protocol-settings",
        assigned: uploaded,
        customUrls: [uploaded],
      }),
    ).toBe(uploaded);
    expect(
      sessionTopicCardStill({
        id: "protocol-settings",
        assigned: uploaded,
        customUrls: [],
        systemImages: FALLBACK_AESTHETIC_IMAGES,
      }),
    ).toBe(uploaded);
    expect(
      resolveIleWorkAestheticImage({
        id: "protocol-settings",
        assigned: uploaded,
        images: FALLBACK_AESTHETIC_IMAGES,
      }),
    ).toBe(uploaded);

    const html = renderToStaticMarkup(
      createElement(SessionTopicCard, {
        id: "protocol-settings",
        title: "Protocol",
        image: uploaded,
        customUrls: [uploaded],
        sidebarStyle: { ...EMPTY_SESSION_SIDEBAR_STYLE, backgroundImage: uploaded },
      }),
    );
    expect(html).toContain(uploaded);
    expect(html).not.toContain("/aesthetics/");
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
    const settings = read("components/organization/protocol-settings-tab.tsx");
    const hook = read("components/organization/use-org-protocol-style.ts");
    const styler = read("components/organization/custom-aesthetics-styler.tsx");
    const page = read("app/dashboard/page.tsx");
    expect(dashboard).not.toContain("CustomAestheticsStyler");
    expect(settings).not.toContain("CustomAestheticsStyler");
    expect(settings).toContain("ProtocolSettingsEditor");
    expect(settings).toContain("data-org-protocol-settings-table");
    expect(settings).toContain("data-org-protocol-settings-edit");
    expect(read("components/organization/protocol-settings-editor.tsx")).toContain(
      "CustomAestheticsStyler",
    );
    expect(page).toContain("ProtocolSettingsTab");
    expect(page).toContain('activeTab === "protocol_settings"');
    expect(page).not.toContain("protocolSettingsEditorOpen");
    expect(page).toContain("overflow-x-hidden p-4 py-8 sm:px-6 lg:px-8");
    expect(styler).toContain('data-org-custom-aesthetics');
    expect(styler).toContain('data-org-aesthetic-upload');
    expect(styler).toContain("multiple={!compact}");
    expect(styler).toContain('accept="image/png,image/jpeg,image/webp,image/gif"');
    expect(styler).toContain('data-org-aesthetic-remove');
    expect(styler).toContain("data-org-custom-aesthetics-assets");
    expect(styler).toContain("{compact ? null : editable && urls.length === 0");
    expect(styler).toContain("data-org-sidebar-style-prompt");
    expect(styler).toContain("data-org-sidebar-style-apply");
    expect(styler).not.toContain("ProtocolSettingsCanvasMock");
    expect(read("components/organization/protocol-settings-editor.tsx")).toContain(
      "ProtocolSettingsCanvasMock",
    );
    expect(styler).toContain("data-org-canvas-grid");
    expect(hook).toContain('fetch("/api/organization/aesthetics"');
    expect(hook).toContain("/api/organization/protocol-settings");
    expect(hook).toContain("/style");
    expect(hook).toContain('method: "POST"');
    expect(hook).toContain('method: "DELETE"');
    expect(hook).toContain("handleAestheticUpload");
    expect(hook).toContain("slice(0, 1)");
    expect(hook).toContain("backgroundImage: nextUrl");
    expect(hook).toContain("(data as { added?: unknown }).added");
    expect(hook).toContain("storedUrls");
    expect(read("components/organization/protocol-settings-canvas-mock.tsx")).toContain(
      "key={brandStill || \"system\"}",
    );
    expect(read("components/organization/protocol-settings-canvas-mock.tsx")).toContain(
      "image={brandStill || null}",
    );
    expect(hook).toContain("handleRemoveAesthetic");
    expect(hook).toContain("applyStyle: false");
    expect(hook).toContain("handleStyleSidebar");
    expect(hook).toContain("handleCanvasStyle");
    expect(styler).toContain("data-org-canvas-background");
    expect(styler).toContain("data-org-canvas-stroke");
    expect(styler).toContain("data-org-canvas-zen");
    expect(read("lib/organization/sidebar-style-generate.ts")).toContain("gridMode: keepGrid");
    expect(read("lib/organization/apply-sidebar-style.ts")).toContain("parseSessionCanvasStyle");
    expect(read("lib/organization/apply-sidebar-style.ts")).toContain("body.backgroundImage");
    expect(read("lib/organization/apply-sidebar-style.ts")).toContain("body.preset");
    expect(styler).toContain("Sparkles");
    expect(styler).toContain("ImagePlus");
    expect(read("app/api/organization/aesthetics/style/route.ts")).toContain("applySidebarStyleBody");
    expect(read("components/ExcalidrawCanvas.tsx")).toContain("sessionCanvasExcalidrawChrome");
    expect(read("components/ExcalidrawCanvas.tsx")).toContain("useSessionSidebarStyle");
    expect(read("components/ExcalidrawCanvas.tsx")).toContain("liveCanvasChrome");
    expect(read("components/ExcalidrawCanvas.tsx")).toContain("ileWorkCanvasRestyleChromeInk");
    expect(hook).toContain("ORGANIZATION_SWITCHED_EVENT");
    expect(hook).toContain("isOrgAdmin");
    expect(read("lib/use-session-sidebar-style.ts")).toContain("ORGANIZATION_SWITCHED_EVENT");
    expect(read("app/api/organization/aesthetics/style/route.ts")).toContain("reset");
    expect(read("app/api/aesthetics/route.ts")).toContain("sidebarStyle");

    const route = read("app/api/organization/aesthetics/route.ts");
    expect(route).toContain("authorizeCustomAestheticEdit");
    expect(route).toContain("applyCustomAestheticUploads");
    expect(route).toContain("removeCustomAestheticUrl");
    expect(route).toContain("addCustomAestheticUrls");
    expect(route).toContain("added: published");

    const migration = read("supabase/migrations/20260923120000_organization_custom_aesthetics.sql");
    expect(migration).toContain("custom_aesthetic_urls");
    expect(migration).toContain("org-aesthetics");
    expect(read("supabase/migrations/20261126160000_sidebar_style.sql")).toContain("sidebar_style");
    expect(read("lib/organization/apply-sidebar-style.ts")).toContain("generateSessionSidebarStyle");
    expect(read("app/api/organization/protocol-settings/[id]/style/route.ts")).toContain(
      "applySidebarStyleBody",
    );
    expect(read("components/session-view/session-sidebar.tsx")).toContain("sessionSidebarStyleCssVars");
  });

  it("session start picks a random package (org custom set when present) without a picker", () => {
    const packs = [
      {
        id: "architecture",
        name: "Architecture",
        images: ["/aesthetics/architecture/a.jpeg", "/aesthetics/architecture/b.jpeg"],
        previewImage: "/aesthetics/architecture/a.jpeg",
      },
      {
        id: "lunar",
        name: "Lunar",
        images: ["/aesthetics/lunar/a.jpeg", "/aesthetics/lunar/b.jpeg"],
        previewImage: "/aesthetics/lunar/a.jpeg",
      },
    ];
    expect(pickRandomAestheticPackage([], () => 0)).toBeUndefined();
    expect(pickRandomAestheticPackage(packs, () => 0)?.id).toBe("architecture");
    expect(pickRandomAestheticPackage(packs, () => 0.99)?.id).toBe("lunar");
    expect(pickRandomAestheticPackage(packs, () => 0.99)?.previewImage).toBe(
      "/aesthetics/lunar/b.jpeg",
    );

    const hook = read("components/session-view/use-aesthetic-packages.ts");
    expect(hook).toContain("pickRandomAestheticPackage");
  });

  it("TAP backgrounds use pickTapBackgroundImage from the org-aware listing", () => {
    const hook = read("components/session-view/use-aesthetic-packages.ts");
    expect(hook).toContain("fetchAestheticPackages");
    for (const rel of ["components/TapScoreClient.tsx"]) {
      const source = read(rel);
      expect(source).toContain("useAestheticPackages");
      expect(source).toContain("selectedAesthetic?.previewImage");
      expect(source).not.toContain("BACKGROUND_IMAGES[");
    }
  });

});
