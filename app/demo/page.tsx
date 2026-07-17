import type { Metadata } from "next";
import { ProofOfWorkApiDemo } from "@/components/ProofOfWorkApiDemo";

export const metadata: Metadata = {
  title: "Demo",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Proof-of-Work API demo | Uncertain Systems",
    description: "Try workspace creation, evidence upload, and learning efficiency scoring.",
    images: [{ url: "/demo/opengraph-image", width: 1200, height: 630, alt: "Demo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Proof-of-Work API demo",
    images: ["/demo/opengraph-image"],
  },
};

export default function DemoPage() {
  return <ProofOfWorkApiDemo />;
}