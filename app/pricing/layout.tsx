import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - Proof-of-Work Volume | openLesson",
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
    title: "Pricing - Proof-of-Work Volume | openLesson",
    description:
      "Meter proof-of-work artifacts across TAP, ILE, and the API. Plans scale with measurement and learning world model effort.",
    url: "https://openlesson.academy/pricing",
    siteName: "openLesson",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | openLesson",
    description:
      "Proof-of-work volume pricing for humans and agents.",
    creator: "@uncertainsys",
  },
  alternates: {
    canonical: "https://openlesson.academy/pricing",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
