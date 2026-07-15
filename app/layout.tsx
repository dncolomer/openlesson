import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BRAND_LOGO_PATH } from "../lib/brand";
import { I18nProvider } from "../lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Uncertain Systems — Learning Efficiency for Humans & Agents",
    template: "%s | Uncertain Systems",
  },
  description:
    "Optimize learning efficiency for humans and agentic systems. Proof-of-Work API, Think Aloud Protocol, ILE, and Agentic Learning Environment on Workspaces.",
  keywords: [
    "learning efficiency platform",
    "think aloud protocol",
    "AI interview cheating detection",
    "genuine human cognition",
    "AI skill assessment",
    "learning efficiency",
    "workplace learning analytics",
    "immersive learning environment",
    "LMS integration API",
    "skills gap analysis",
    "AI training evaluation",
    "educational technology",
  ],
  metadataBase: new URL("https://uncertain.systems"),
  icons: {
    icon: BRAND_LOGO_PATH,
    shortcut: BRAND_LOGO_PATH,
    apple: BRAND_LOGO_PATH,
  },
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "https://uncertain.systems",
  },
  openGraph: {
    title: "Uncertain Systems — Learning Efficiency for Humans & Agents",
    description:
      "Measure what learners actually absorb — not just completion. Four products on Workspaces.",
    url: "https://uncertain.systems",
    siteName: "Uncertain Systems",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Uncertain Systems — Learning Efficiency Platform",
    description:
      "Optimize learning efficiency with Proof-of-Work API, Think Aloud Protocol, ILE, and Agentic Learning Environment.",
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
  name: "Uncertain Systems",
  url: "https://uncertain.systems",
  description:
    "Learning efficiency platform on Workspaces: Proof-of-Work API, Think Aloud Protocol, ILE, and Agentic Learning Environment.",
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
  name: "Uncertain Systems",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Learning efficiency measurement and improvement on Workspaces—via Proof-of-Work API, Think Aloud Protocol, ILE, and Agentic Learning Environment.",
  featureList: [
    "Workspaces",
    "Proof-of-Work API — headless efficiency scoring",
    "Think Aloud Protocol — live human cognition",
    "Integrated Learning Environment — human learning",
    "Agentic Learning Environment — skill development for skill.md developers",
    "Continuous scoring and gap analysis",
    "Proof-of-Work API for LMS integration",
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
