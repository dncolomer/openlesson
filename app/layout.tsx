import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { I18nProvider } from "../lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "openLesson — Learning Verification for Humans & Agents",
    template: "%s | openLesson",
  },
  description:
    "Beyond benchmarks for AI and beyond quizzes for humans. Evidence API, Think Aloud Protocol, ILE, and Agentic Learning Environment on Verification Workspaces.",
  keywords: [
    "learning verification platform",
    "think aloud protocol",
    "AI interview cheating detection",
    "genuine human cognition",
    "AI skill assessment",
    "learning verification",
    "workplace learning analytics",
    "immersive learning environment",
    "LMS integration API",
    "skills gap analysis",
    "AI training evaluation",
    "educational technology",
  ],
  metadataBase: new URL("https://openlesson.academy"),
  icons: {
    icon: "/new_logo.jpg",
    shortcut: "/new_logo.jpg",
    apple: "/new_logo.jpg",
  },
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "https://openlesson.academy",
  },
  openGraph: {
    title: "openLesson — Learning Verification for Humans & Agents",
    description:
      "Beyond benchmarks for AI and beyond quizzes for humans. Four products on Verification Workspaces.",
    url: "https://openlesson.academy",
    siteName: "openLesson",
    images: [
      {
        url: "/og-default.jpg",
        width: 1024,
        height: 536,
        alt: "openLesson — learning verification platform for humans and agents.",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "openLesson — Learning Verification Platform",
    description:
      "Evidence API, Think Aloud Protocol, ILE, and Agentic Learning Environment, built on Verification Workspaces.",
    images: ["/og-default.jpg"],
    creator: "@uncertainsys",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

// JSON-LD structured data for Organization
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "openLesson",
  url: "https://openlesson.academy",
  description:
    "Four products on Verification Workspaces: Evidence API, Think Aloud Protocol, ILE, and Agentic Learning Environment.",
  founder: {
    "@type": "Person",
    name: "Daniel Colomer",
  },
  sameAs: [
    "https://x.com/uncertainsys",
    "https://github.com/dncolomer/openlesson",
  ],
};

// JSON-LD structured data for SoftwareApplication
const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "openLesson",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Learning verification and improvement on Verification Workspaces—via Evidence API, Think Aloud Protocol, ILE, and Agentic Learning Environment.",
  featureList: [
    "Verification Workspaces",
    "Evidence API — headless verification",
    "Think Aloud Protocol — human verification",
    "Integrated Learning Environment — human learning",
    "Agentic Learning Environment — skill development for skill.md developers",
    "Continuous scoring and gap analysis",
    "Evidence API for LMS integration",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareSchema),
          }}
        />
      </head>
      <body className="antialiased min-h-screen">
        <I18nProvider>
          {children}
        </I18nProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
