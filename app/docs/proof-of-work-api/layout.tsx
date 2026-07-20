import { Metadata } from "next";
import { openGraphImagesForRoutePath } from "@/lib/og/paths";

const ogImages = openGraphImagesForRoutePath(
  "/docs/proof-of-work-api",
  "Proof-of-Work API Specification",
);

export const metadata: Metadata = {
  title: "Proof-of-Work API Specification - Uncertain Systems",
  description: "Comprehensive specification for the Uncertain Systems Proof-of-Work API, enabling external AI agents to measure learning efficiency from workspaces, evidence, and TAP sessions.",
  openGraph: {
    title: "Proof-of-Work API Specification",
    description: "Enable AI agents to upload proof of work on Workspaces, issue Think Aloud Protocol (TAP) links, route ILE practice, and read learning efficiency results.",
    url: "https://uncertain.systems/docs/proof-of-work-api",
    siteName: "Uncertain Systems",
    type: "website",
    images: ogImages,
  },
  twitter: {
    card: "summary_large_image",
    title: "Proof-of-Work API Specification",
    description: "Enable AI agents to upload proof of work on Workspaces, issue Think Aloud Protocol (TAP) links, route ILE practice, and read learning efficiency results.",
    images: ogImages.map((image) => image.url),
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
