import { ImageResponse } from "next/og";
import {
  absoluteSiteUrl,
  getPublicInsightForMeta,
  insightPublicSlug,
  resolveInsightAestheticImage,
} from "@/lib/insights-server";

export const alt = "openLesson insight";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface ImageProps {
  params: Promise<{ id: string }>;
}

function truncateTitle(title: string, maxLength = 120) {
  const clean = title.trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

function truncateSummary(summary: string, maxLength = 180) {
  const clean = summary.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

export default async function Image({ params }: ImageProps) {
  const { id } = await params;
  const insight = await getPublicInsightForMeta(id);
  const title = truncateTitle(insight?.title || "Insight");
  const summary = truncateSummary(insight?.summary || "A bookmark from think-aloud learning on openLesson.");
  const backgroundImage = absoluteSiteUrl(resolveInsightAestheticImage(insight?.aesthetic_image));

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <img
          src={backgroundImage}
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
              "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 38%, rgba(0,0,0,0.18) 100%)",
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
              openLesson
            </div>
            <div
              style={{
                fontSize: "14px",
                color: "#fbbf24",
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Insight
            </div>
          </div>

          <div
            style={{
              fontSize: "58px",
              color: "white",
              fontWeight: 700,
              lineHeight: 1.08,
              maxWidth: "980px",
              textShadow: "0 4px 30px rgba(0,0,0,0.65)",
            }}
          >
            {title}
          </div>

          <div
            style={{
              marginTop: "22px",
              fontSize: "28px",
              color: "#d4d4d8",
              lineHeight: 1.35,
              maxWidth: "920px",
              textShadow: "0 2px 18px rgba(0,0,0,0.55)",
            }}
          >
            {summary}
          </div>
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
            <div style={{ fontSize: "16px", color: "#fcd34d", fontWeight: 600 }}>Think-aloud bookmark</div>
          </div>

          <div style={{ fontSize: "18px", color: "#a1a1aa", fontWeight: 500 }}>
            {insight ? `openlesson.academy/insights/${insightPublicSlug(insight)}` : "openlesson.academy"}
          </div>
        </div>
      </div>
    ),
    { width: size.width, height: size.height },
  );
}