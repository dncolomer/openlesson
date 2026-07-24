import type { Metadata } from "next";
import { ScienceWhitepaperPage } from "@/components/ScienceWhitepaperPage";
import {
  TAP_STASH_SUBMIT_WHITEPAPER,
  TAP_WHITEPAPER_PATH,
} from "@/lib/science/tap-stash-submit-whitepaper";

const paper = TAP_STASH_SUBMIT_WHITEPAPER;

export const metadata: Metadata = {
  title: paper.meta.shortTitle,
  description: paper.meta.description,
  alternates: { canonical: `https://uncertain.systems${TAP_WHITEPAPER_PATH}` },
  openGraph: {
    title: `${paper.meta.shortTitle} | Uncertain Systems`,
    description: paper.meta.description,
    url: `https://uncertain.systems${TAP_WHITEPAPER_PATH}`,
  },
  twitter: {
    card: "summary_large_image",
    title: `${paper.meta.shortTitle} | Uncertain Systems`,
    description: paper.meta.description,
  },
};

export default function ThinkAloudProtocolWhitepaperPage() {
  return <ScienceWhitepaperPage paper={paper} />;
}
