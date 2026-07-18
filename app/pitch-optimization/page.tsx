import type { Metadata } from "next";
import { SalesSlideDeck } from "@/components/SalesSlideDeck";
import { OPTIMIZATION_PITCH_DECK } from "@/lib/sales/optimization-pitch-deck";

export const metadata: Metadata = {
  title: "Optimization Pitch",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function PitchOptimizationPage() {
  return <SalesSlideDeck deck={OPTIMIZATION_PITCH_DECK} />;
}
