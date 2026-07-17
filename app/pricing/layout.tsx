import { Metadata } from "next";
import { openGraphImagesForRoutePath } from "@/lib/og/paths";

const ogImages = openGraphImagesForRoutePath(
  "/pricing",
  "Pricing - Proof-of-Work Volume | Uncertain Systems",
);

export const metadata: Metadata = {
  title: "Pricing - Proof-of-Work Volume | Uncertain Systems",
  description:
    "Pay for proof-of-work submissions across every product. Pricing scales with measurement volume and learning world model building.",
  keywords: [
    "AI tutor pricing",
    "learning platform cost",
    "AI tutoring subscription",
    "educational AI pricing",
    "open source AI tutor",
  ],
  openGraph: {
    title: "Pricing - Proof-of-Work Volume | Uncertain Systems",
    description:
      "Meter proof-of-work artifacts across TAP, ILE, and the API. Plans scale with measurement and learning world model effort.",
    url: "https://uncertain.systems/pricing",
    siteName: "Uncertain Systems",
    type: "website",
    images: ogImages,
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | Uncertain Systems",
    description:
      "Proof-of-work volume pricing for humans and agents.",
    creator: "@uncertainsys",
    images: ogImages.map((image) => image.url),
  },
  alternates: {
    canonical: "https://uncertain.systems/pricing",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
