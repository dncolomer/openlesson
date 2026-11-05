import { Metadata } from "next";
import { ACADEMY_K_HREF } from "@/lib/marketing/paths";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: ACADEMY_K_HREF,
});

export const metadata: Metadata = {
  title: "Course authoring",
  description: "Course authoring lives on Academy-k.",
  robots: { index: false, follow: true },
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
