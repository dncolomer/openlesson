import { Metadata } from "next";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/pricing",
});

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Buy Learning, Verification, or Calibration. Try everything for 3 days for $24.99. Course authoring and custom setup on request.",
  keywords: [
    "AI tutor pricing",
    "learning platform cost",
    "AI tutoring subscription",
    "educational AI pricing",
    "open source AI tutor",
  ],
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
  alternates: {
    canonical: "https://uncertain.systems/pricing",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
