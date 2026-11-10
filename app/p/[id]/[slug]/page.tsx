import type { Metadata } from "next";
import { RetiredProductPage } from "@/components/retired-product-page";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const social = standardShareSocialMetadata();

export const metadata: Metadata = {
  title: "Uncertain Systems",
  openGraph: social.openGraph,
  twitter: social.twitter,
};

export default function PublicPlanRetiredPage() {
  return <RetiredProductPage />;
}
