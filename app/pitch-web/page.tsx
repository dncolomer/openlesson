import type { Metadata } from "next";
import { PitchWebDeck } from "@/components/pitch-web/pitch-web-deck";

export const metadata: Metadata = {
  title: "Uncertain Systems — Pitch",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function PitchWebPage() {
  return <PitchWebDeck />;
}
