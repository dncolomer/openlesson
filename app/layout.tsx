import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenLesson — AI-Powered Adaptive Learning",
  description: "Generate personalized lesson plans with AI. Learn any topic through adaptive challenges that evolve based on your progress.",
  keywords: ["learning", "AI", "education", "lesson plans", "adaptive learning", "challenges"],
  authors: [{ name: "OpenLesson" }],
  openGraph: {
    title: "OpenLesson — AI-Powered Adaptive Learning",
    description: "Generate personalized lesson plans with AI. Learn any topic through adaptive challenges.",
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
