import { Metadata } from "next";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/pricing",
});

export const metadata: Metadata = {
  title: "Learning Harness pricing",
  description:
    "Fixed monthly Learning Harness subscription of $24.99, or try unlimited for 3 days for $14.99. All-You-Can-Learn lifetime buys live alongside this plan.",
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
