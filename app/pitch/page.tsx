import type { Metadata } from "next";
import { SalesSlideDeck } from "@/components/SalesSlideDeck";
import { PLATFORM_PITCH_DECK } from "@/lib/sales/platform-pitch-deck";

export const metadata: Metadata = {
  title: "Platform Pitch",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function PitchPage() {
  return <SalesSlideDeck deck={PLATFORM_PITCH_DECK} />;
}
