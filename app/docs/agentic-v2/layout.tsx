import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agentic API v2 Specification - OpenLesson",
  description: "Comprehensive specification for the OpenLesson Agentic API v2, enabling external AI agents to act as tutors using OpenLesson's educational intelligence.",
  openGraph: {
    title: "Agentic API v2 Specification",
    description: "Enable AI agents to create Performance Workspaces, issue GHL Score links, and read learning verification results.",
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
