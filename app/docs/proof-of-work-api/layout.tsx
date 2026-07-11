import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Proof-of-Work API Specification - OpenLesson",
  description: "Comprehensive specification for the OpenLesson Proof-of-Work API, enabling external AI agents to measure learning efficiency from workspaces, evidence, and TAP sessions.",
  openGraph: {
    title: "Proof-of-Work API Specification",
    description: "Enable AI agents to create Verification Workspaces, issue Think Aloud Protocol (TAP) links, route ILE practice, and read learning efficiency results.",
    url: "https://openlesson.academy/docs/proof-of-work-api",
    siteName: "OpenLesson",
    type: "website",
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
