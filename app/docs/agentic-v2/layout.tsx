import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Evidence API Specification - OpenLesson",
  description: "Comprehensive specification for the OpenLesson Evidence API, enabling external AI agents to verify learning from workspaces, evidence, and TAP sessions.",
  openGraph: {
    title: "Evidence API Specification",
    description: "Enable AI agents to create Verification Workspaces, issue Think Aloud Protocol (TAP) links, route ILE practice, and read learning verification results.",
    url: "https://openlesson.academy/docs/agentic-v2",
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
