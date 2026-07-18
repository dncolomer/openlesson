import type { Metadata } from "next";
import { SalesSlideDeck } from "@/components/SalesSlideDeck";
import { PRODUCT_PITCH_DECK } from "@/lib/sales/product-pitch-deck";

export const metadata: Metadata = {
  title: "Product Pitch",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function PitchProductPage() {
  return <SalesSlideDeck deck={PRODUCT_PITCH_DECK} />;
}
