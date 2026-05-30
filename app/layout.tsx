import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { I18nProvider } from "../lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "openLesson - AI Tutor That Listens to You Think",
    template: "%s | openLesson",
  },
  description:
    "AI-powered tutoring that listens to you reason and asks the right questions at the right time. For students, professionals, and teams.",
  keywords: [
    "AI tutor",
    "AI learning platform",
    "personalized learning",
    "AI education",
    "online tutoring",
    "AI training software",
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
    title: "openLesson - AI Tutor That Listens to You Think",
    description:
      "An AI tutor that listens to you reason and asks questions when it spots gaps in your understanding. Free and open source.",
    url: "https://openlesson.academy",
    siteName: "openLesson",
    images: [
      {
        url: "/og-default.jpg",
        width: 1024,
        height: 536,
        alt: "openLesson - an AI tutor that listens to reasoning and asks better questions.",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "openLesson - AI Tutor That Listens to You Think",
    description:
      "An AI tutor that listens to you reason and asks questions when it spots gaps in your understanding.",
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
    "AI-powered tutoring that listens to you reason and asks the right questions at the right time.",
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
    "AI tutor that listens to you reason out loud and asks questions to deepen your understanding.",
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
      </body>
    </html>
  );
}
