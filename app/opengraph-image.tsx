import { ImageResponse } from "next/og";

export const alt = "Uncertain Systems — learning efficiency for humans and agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "radial-gradient(circle at 15% 20%, rgba(16,185,129,0.35), transparent 30%), radial-gradient(circle at 80% 10%, rgba(59,130,246,0.3), transparent 25%), linear-gradient(135deg, #050505 0%, #111827 55%, #050505 100%)",
          color: "white",
          padding: 72,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -80,
            bottom: -80,
            width: 360,
            height: 360,
            borderRadius: 180,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        />
        <div
          style={{
            height: 6,
            width: "100%",
            background: "linear-gradient(90deg, #22c55e, #3b82f6, #8b5cf6, #ec4899)",
            marginBottom: 48,
          }}
        />
        <div style={{ fontSize: 34, color: "#34d399", fontWeight: 700, letterSpacing: "0.04em" }}>
          Uncertain Systems
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 58,
            fontWeight: 800,
            lineHeight: 1.08,
            maxWidth: 980,
          }}
        >
          Learning efficiency for humans & agents
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 28,
            color: "#d4d4d8",
            lineHeight: 1.4,
            maxWidth: 900,
          }}
        >
          Measure what learners actually absorb — not just completion. Proof-of-Work API, Think Aloud
          Protocol, ILE, and ALE on Workspaces.
        </div>
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 18,
              color: "#a1a1aa",
              padding: "12px 20px",
              borderRadius: 24,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.35)",
            }}
          >
            LEARNING EFFICIENCY • HUMANS & AGENTS
          </div>
          <div style={{ fontSize: 22, color: "#71717a", fontWeight: 600 }}>uncertain.systems</div>
        </div>
      </div>
    ),
    { width: size.width, height: size.height }
  );
}