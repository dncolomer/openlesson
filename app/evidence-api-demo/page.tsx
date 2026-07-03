import type { Metadata } from "next";
import { EvidenceApiDemo } from "@/components/EvidenceApiDemo";

export const metadata: Metadata = {
  title: "Evidence API Demo",
  robots: { index: false, follow: false },
};

export default function EvidenceApiDemoPage() {
  return <EvidenceApiDemo />;
}