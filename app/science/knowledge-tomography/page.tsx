import type { Metadata } from "next";
import { ScienceWhitepaperPage } from "@/components/ScienceWhitepaperPage";
import {
  KNOWLEDGE_TOMOGRAPHY_WHITEPAPER,
  KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH,
} from "@/lib/science/knowledge-tomography-whitepaper";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const paper = KNOWLEDGE_TOMOGRAPHY_WHITEPAPER;
const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH}`,
});

export const metadata: Metadata = {
  title: paper.meta.shortTitle,
  description: paper.meta.description,
  alternates: {
    canonical: `https://uncertain.systems${KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH}`,
  },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function KnowledgeTomographyWhitepaperPage() {
  return <ScienceWhitepaperPage paper={paper} />;
}
