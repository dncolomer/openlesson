import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SCIENCE_HUB_COPY, SCIENCE_HUB_PATH } from "@/lib/science/hub";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${SCIENCE_HUB_PATH}`,
});

export const metadata: Metadata = {
  title: "Vision",
  description: SCIENCE_HUB_COPY.lead,
  alternates: { canonical: "https://uncertain.systems/science" },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function VisionPage() {
  redirect("/science");
}
