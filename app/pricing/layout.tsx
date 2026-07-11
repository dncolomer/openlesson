import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - Learning Efficiency Plans | openLesson",
  description:
    "Choose monthly Proof-of-Work submission volume. TAP, ILE, and API usage share one meter.",
  keywords: [
    "AI tutor pricing",
    "learning platform cost",
    "AI tutoring subscription",
    "educational AI pricing",
    "open source AI tutor",
  ],
  openGraph: {
    title: "Pricing - Learning Efficiency Plans | openLesson",
    description:
      "Create Workspaces, measure learning efficiency, and choose monthly Proof-of-Work submission volume.",
    url: "https://openlesson.academy/pricing",
    siteName: "openLesson",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | openLesson",
    description:
      "Learning efficiency plans for humans and agents.",
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
