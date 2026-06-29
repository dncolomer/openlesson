import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { I18nProvider } from "../lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "openLesson — Prove Performance Readiness in AI-Enabled Work",
    template: "%s | openLesson",
  },
  description:
    "Three products on Performance Workspaces: Evidence API for headless verification, Think-Aloud Protocol for hosted cognitive scoring, and the Integrated Learning Environment to close gaps.",
  keywords: [
    "performance readiness platform",
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
    title: "openLesson — Prove Performance Readiness",
    description:
      "Three products on Performance Workspaces: Evidence API, Think-Aloud Protocol, and the Integrated Learning Environment.",
    url: "https://openlesson.academy",
    siteName: "openLesson",
    images: [
      {
        url: "/og-default.jpg",
        width: 1024,
        height: 536,
        alt: "openLesson — performance readiness platform for AI-enabled learning.",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "openLesson — Performance Readiness Platform",
    description:
      "Evidence API, Think-Aloud Protocol, and Integrated Learning Environment—built on Performance Workspaces.",
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
    "Three products on Performance Workspaces: Evidence API, Think-Aloud Protocol, and Integrated Learning Environment.",
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
    "Human knowledge verification and improvement on Performance Workspaces—via Evidence API, Think-Aloud Protocol, and the Integrated Learning Environment.",
  featureList: [
    "Performance Workspaces",
    "Evidence API — headless verification",
    "Think-Aloud Protocol — hosted verification",
    "Integrated Learning Environment",
    "Continuous scoring and gap analysis",
    "Agentic API v2 for LMS integration",
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
