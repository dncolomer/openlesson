import { Metadata } from "next";
import { AUTHORING_PRICING_PATH } from "@/lib/marketing/paths";
import { AUTHORING_PRICING_COPY } from "@/lib/pricing/authoring-copy";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${AUTHORING_PRICING_PATH}`,
});

export const metadata: Metadata = {
  title: "Learning Experience Authoring pricing",
  description: AUTHORING_PRICING_COPY.lead,
  alternates: { canonical: `https://uncertain.systems${AUTHORING_PRICING_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function AuthoringPricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
