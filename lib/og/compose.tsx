import { ImageResponse } from "next/og";
import { loadAestheticDataUrl, resolveOgAestheticPath } from "@/lib/og/aesthetic";
import { UNSYS_STANDARD_SHARE } from "@/lib/og/standard";
import { getOgSurface, type OgSurface } from "@/lib/og/surfaces";
import { truncateOgDescription, truncateOgTitle } from "@/lib/og/text";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/jpeg";
const OG_JPEG_MAX_BYTES = 1_000_000;

export type ComposeOgImageInput = {
  title: string;
  description?: string;
  eyebrow?: string;
  brand?: string;
  footerLabel?: string;
  /** Site-relative `/aesthetics/...` or any preferred path; non-aesthetics fall back via seed. */
  aestheticPath?: string | null;
  aestheticSeed?: string;
  siteLabel?: string;
};

function cardJsx(options: {
  title: string;
  description: string;
  eyebrow: string;
  brand: string;
  footerLabel: string;
  siteLabel: string;
  backgroundSrc: string;
}) {
  const { title, description, eyebrow, brand, footerLabel, siteLabel, backgroundSrc } = options;

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        color: "white",
      }}
    >
      <img
        src={backgroundSrc}
        alt=""
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 38%, rgba(0,0,0,0.22) 100%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "6px",
          width: "100%",
          background: "linear-gradient(90deg, #f59e0b, #ef4444, #a855f7, #3b82f6)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "56px 72px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "40px",
            left: "72px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              color: "#f5f5f5",
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            {brand}
          </div>
          {eyebrow ? (
            <div
              style={{
                fontSize: "14px",
                color: "#fbbf24",
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </div>
          ) : null}
        </div>

        <div
          style={{
            fontSize: "56px",
            color: "white",
            fontWeight: 700,
            lineHeight: 1.08,
            maxWidth: "980px",
            textShadow: "0 4px 30px rgba(0,0,0,0.65)",
          }}
        >
          {title}
        </div>

        {description ? (
          <div
            style={{
              marginTop: "22px",
              fontSize: "26px",
              color: "#d4d4d8",
              lineHeight: 1.35,
              maxWidth: "920px",
              textShadow: "0 2px 18px rgba(0,0,0,0.55)",
            }}
          >
            {description}
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "24px 72px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 18px",
            borderRadius: "24px",
            backgroundColor: "rgba(245, 158, 11, 0.14)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "4px",
              backgroundColor: "#f59e0b",
            }}
          />
          <div style={{ fontSize: "16px", color: "#fcd34d", fontWeight: 600 }}>{footerLabel}</div>
        </div>

        <div style={{ fontSize: "18px", color: "#a1a1aa", fontWeight: 500 }}>{siteLabel}</div>
      </div>
    </div>
  );
}

/**
 * Shared OG compositor: aesthetics background + brand chrome + dynamic text.
 * All public opengraph-image entrypoints should call this (or a thin wrapper).
 */
export async function composeOgImage(input: ComposeOgImageInput): Promise<Response> {
  const seed = input.aestheticSeed ?? input.title;
  const aestheticPath = resolveOgAestheticPath({
    preferred: input.aestheticPath,
    seed,
  });
  const backgroundSrc = await loadAestheticDataUrl(aestheticPath);

  const title = truncateOgTitle(input.title);
  const description = input.description ? truncateOgDescription(input.description) : "";
  const brand = input.brand?.trim() || "Uncertain Systems";
  const eyebrow = input.eyebrow?.trim() || "";
  const footerLabel = input.footerLabel?.trim() || "Uncertain Systems";
  const siteLabel = input.siteLabel?.trim() || "uncertain.systems";

  const png = new ImageResponse(
    cardJsx({
      title,
      description,
      eyebrow,
      brand,
      footerLabel,
      siteLabel,
      backgroundSrc,
    }),
    { width: OG_SIZE.width, height: OG_SIZE.height },
  );
  return toShareJpeg(png);
}

async function toShareJpeg(png: ImageResponse): Promise<Response> {
  const sharp = (await import("sharp")).default;
  const raw = Buffer.from(await png.arrayBuffer());
  let jpeg = await sharp(raw).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  if (jpeg.byteLength >= OG_JPEG_MAX_BYTES) {
    jpeg = await sharp(raw).jpeg({ quality: 62, mozjpeg: true }).toBuffer();
  }
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": OG_CONTENT_TYPE,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

/**
 * The one unsys standard share card (LP title/text + aesthetics).
 * Prefer this for all public opengraph-image entrypoints.
 */
export async function composeStandardOgImage(): Promise<Response> {
  return composeOgImage({
    title: UNSYS_STANDARD_SHARE.title,
    description: UNSYS_STANDARD_SHARE.description,
    eyebrow: UNSYS_STANDARD_SHARE.eyebrow,
    brand: UNSYS_STANDARD_SHARE.brand,
    footerLabel: UNSYS_STANDARD_SHARE.footerLabel,
    aestheticPath: UNSYS_STANDARD_SHARE.aestheticImage,
    aestheticSeed: "home",
    siteLabel: UNSYS_STANDARD_SHARE.siteLabel,
  });
}

export async function composeOgImageFromSurface(
  surface: OgSurface,
  _overrides: Partial<ComposeOgImageInput> = {},
): Promise<Response> {
  // Surfaces are registered for inventory only; share cards always use the unsys standard.
  void surface;
  void _overrides;
  return composeStandardOgImage();
}

export async function composeOgImageForSurfaceId(
  surfaceId: string,
  overrides: Partial<ComposeOgImageInput> = {},
): Promise<Response> {
  // Keep surface lookup so unknown ids still throw; card content is always standard.
  getOgSurface(surfaceId);
  void overrides;
  return composeStandardOgImage();
}
