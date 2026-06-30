import type { ReactNode } from "react";

export default function SolutionSlidesLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#070707]">{children}</div>;
}