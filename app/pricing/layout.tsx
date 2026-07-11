import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - Learning Efficiency Plans | openLesson",
  description:
    "Create Workspaces and choose monthly TAP / ILE session volume plus Proof-of-Work API submission caps.",
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
      "Create Workspaces, measure learning efficiency, and choose monthly TAP / ILE session volume.",
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
