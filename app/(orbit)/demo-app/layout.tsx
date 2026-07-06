import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Orbit",
  robots: { index: false, follow: false },
};

export default function OrbitDemoAppLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0d0d0d] text-[#e8e8f0]">{children}</div>;
}