import type { Metadata } from "next";
import { ScienceWhitepaperPage } from "@/components/ScienceWhitepaperPage";
import {
  TAP_STASH_SUBMIT_WHITEPAPER,
  TAP_WHITEPAPER_PATH,
} from "@/lib/science/tap-stash-submit-whitepaper";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const paper = TAP_STASH_SUBMIT_WHITEPAPER;
const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${TAP_WHITEPAPER_PATH}`,
});

export const metadata: Metadata = {
  title: paper.meta.shortTitle,
  description: paper.meta.description,
  alternates: { canonical: `https://uncertain.systems${TAP_WHITEPAPER_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function ThinkAloudProtocolWhitepaperPage() {
  return <ScienceWhitepaperPage paper={paper} />;
}
