import type { Metadata } from "next";
import { EvidenceApiDemo } from "@/components/EvidenceApiDemo";

export const metadata: Metadata = {
  title: "Demo",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <EvidenceApiDemo />;
}