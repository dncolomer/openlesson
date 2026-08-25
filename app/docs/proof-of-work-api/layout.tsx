import { Metadata } from "next";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/docs/proof-of-work-api",
});

export const metadata: Metadata = {
  title: "Proof-of-Work API Specification - Uncertain Systems",
  description: "Comprehensive specification for the Uncertain Systems Proof-of-Work API — workspaces, evidence, and TAP sessions for Knowledge Verification.",
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
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
