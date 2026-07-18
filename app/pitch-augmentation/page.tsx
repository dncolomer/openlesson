import type { Metadata } from "next";
import { SalesSlideDeck } from "@/components/SalesSlideDeck";
import { AUGMENTATION_PITCH_DECK } from "@/lib/sales/augmentation-pitch-deck";

export const metadata: Metadata = {
  title: "Augmentation Pitch",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function PitchAugmentationPage() {
  return <SalesSlideDeck deck={AUGMENTATION_PITCH_DECK} />;
}
