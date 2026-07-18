import type { Metadata } from "next";
import { SalesSlideDeck } from "@/components/SalesSlideDeck";
import { VERIFICATION_PITCH_DECK } from "@/lib/sales/verification-pitch-deck";

export const metadata: Metadata = {
  title: "Verification Pitch",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function PitchVerificationPage() {
  return <SalesSlideDeck deck={VERIFICATION_PITCH_DECK} />;
}
