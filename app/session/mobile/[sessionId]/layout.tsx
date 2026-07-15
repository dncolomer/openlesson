import { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Mobile Block | Uncertain Systems",
  description: "Continue your learning session on mobile",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function MobileSessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
