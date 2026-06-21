import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - Performance Readiness Plans | openLesson",
  description:
    "Create Performance Workspaces, measure readiness, and buy additional lessons at $4.99 each.",
  keywords: [
    "AI tutor pricing",
    "learning platform cost",
    "AI tutoring subscription",
    "educational AI pricing",
    "open source AI tutor",
  ],
  openGraph: {
    title: "Pricing - Performance Readiness Plans | openLesson",
    description:
      "Create Performance Workspaces, measure readiness, and buy additional lessons at $4.99 each.",
    url: "https://openlesson.academy/pricing",
    siteName: "openLesson",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | openLesson",
    description:
      "Performance readiness plans for AI-enabled teams.",
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
