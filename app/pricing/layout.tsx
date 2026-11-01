import { Metadata } from "next";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/pricing",
});

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Sign up free, get starter credits, and buy one-time credit packs to run Calibrate, Learn, Verify, and Solve sessions.",
  keywords: [
    "AI tutor pricing",
    "learning platform cost",
    "usage credits",
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
