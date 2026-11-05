import { Metadata } from "next";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/docs/learning-map-api",
});

export const metadata: Metadata = {
  title: "Learning Map API - Uncertain Systems",
  description:
    "Create Learning Maps and independent Solve, Calibration, and Verification flows. Proof of work stays in the product UI (Calibrate, Learn, and Verify).",
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
