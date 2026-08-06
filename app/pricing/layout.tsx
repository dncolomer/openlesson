import { Metadata } from "next";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/pricing",
});

export const metadata: Metadata = {
  title: "Pricing - Proof-of-Work Volume | Uncertain Systems",
  description:
    "Pay for proof-of-work submissions across every product. Pricing scales with measurement volume and learning world model building.",
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
