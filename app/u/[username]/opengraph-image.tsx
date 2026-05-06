import { ImageResponse } from "next/og";
import { getPublicProfile, profileDisplayName } from "@/lib/public-profile";

export const alt = "openLesson public learning profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface ImageProps {
  params: Promise<{ username: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  const displayName = profile ? profileDisplayName(profile) : `@${username}`;
  const topics = profile?.topics.slice(0, 4).map((topic) => topic.name).join(" · ") || "Public learning profile";
  const sessions = profile?.stats.completed_sessions;
  const minutes = profile?.stats.learning_minutes;
  const hours = minutes === null || minutes === undefined ? null : Math.max(1, Math.round(minutes / 60));

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "radial-gradient(circle at 15% 20%, rgba(16,185,129,0.35), transparent 30%), radial-gradient(circle at 80% 10%, rgba(59,130,246,0.3), transparent 25%), linear-gradient(135deg, #050505 0%, #111827 55%, #050505 100%)",
          color: "white",
          padding: 72,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", right: -80, bottom: -80, width: 360, height: 360, borderRadius: 180, border: "1px solid rgba(255,255,255,0.12)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 30, color: "#34d399", fontWeight: 700 }}>openLesson</div>
          <div style={{ fontSize: 22, color: "#a1a1aa" }}>public learning profile</div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 44 }}>
          <div style={{ width: 170, height: 170, borderRadius: 42, background: "linear-gradient(135deg, #34d399, #38bdf8, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 82, fontWeight: 800, boxShadow: "0 30px 80px rgba(56,189,248,0.25)" }}>
            {(profile?.username || username).slice(0, 1).toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.02 }}>{displayName}</div>
            <div style={{ marginTop: 14, fontSize: 30, color: "#a1a1aa" }}>@{profile?.username || username}</div>
            <div style={{ marginTop: 28, fontSize: 25, color: "#d4d4d8", maxWidth: 760, lineHeight: 1.35 }}>{topics}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 18 }}>
          <Stat label="public plans" value={String(profile?.stats.public_plans ?? 0)} />
          <Stat label="completed sessions" value={sessions === null || sessions === undefined ? "private" : String(sessions)} />
          <Stat label="learning hours" value={hours === null ? "private" : String(hours)} />
        </div>
      </div>
    ),
    { width: size.width, height: size.height }
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "18px 24px", borderRadius: 22, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)" }}>
      <div style={{ fontSize: 34, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 18, color: "#a1a1aa" }}>{label}</div>
    </div>
  );
}
