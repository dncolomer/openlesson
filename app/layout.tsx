import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BRAND_LOGO_PATH } from "../lib/brand";
import { I18nProvider } from "../lib/i18n";
import {
  standardShareSocialMetadata,
  UNSYS_STANDARD_SHARE_DESCRIPTION,
  unsysRootHtmlMetadata,
} from "@/lib/og/standard";
import "./globals.css";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems",
});
const rootHtml = unsysRootHtmlMetadata();

export const metadata: Metadata = {
  title: rootHtml.title,
  description: rootHtml.description,
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
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
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
  description: UNSYS_STANDARD_SHARE_DESCRIPTION,
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
  description: UNSYS_STANDARD_SHARE_DESCRIPTION,
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
