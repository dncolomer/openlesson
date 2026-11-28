import type { NextConfig } from "next";
import path from "node:path";

const supabaseImageHostname = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (raw) {
    try {
      return new URL(raw).hostname;
    } catch {
      // Fall back to default hostname below if env var is malformed
    }
  }
  return "xzwjlkngxuxttvqbboea.supabase.co";
})();

const nextConfig: NextConfig = {
  // Isolated dist dir for parallel `next dev` (e.g. pilot servers) without fighting .next/dev/lock
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // A package-lock.json in the parent UncertainSystems folder otherwise becomes
  // the Turbopack workspace root, and CSS cannot resolve tailwindcss.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/unsyslogo.jpeg",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/pitch", destination: "/pitch.pdf" },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseImageHostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;