import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SalesSlideDeck } from "@/components/SalesSlideDeck";
import { getSolutionSlideDeck, SLIDE_DECK_SLUGS } from "@/lib/sales/solution-slide-decks";

type PageProps = {
  params: Promise<{ vertical: string }>;
};

export function generateStaticParams() {
  return SLIDE_DECK_SLUGS.map((vertical) => ({ vertical }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { vertical } = await params;
  const deck = getSolutionSlideDeck(vertical);
  if (!deck) return {};

  return {
    title: `${deck.label} — Sales Deck`,
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  };
}

export default async function SolutionSlidesPage({ params }: PageProps) {
  const { vertical } = await params;
  const deck = getSolutionSlideDeck(vertical);
  if (!deck) notFound();

  return <SalesSlideDeck deck={deck} />;
}