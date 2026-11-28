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
      {
        source: "/docs/agentic-v2-draft",
        destination: "/docs/learning-map-api",
        permanent: true,
      },
      {
        source: "/docs/agentic-v2",
        destination: "/docs/learning-map-api",
        permanent: true,
      },

      // Former /platform marketing path must not redirect onto use-cases.
      // Nav "Platform" uses client hash /#platform on home — server redirects stay path-only.
      { source: "/platform", destination: "/", permanent: true },
      { source: "/use-cases/:path+", destination: "/use-cases", permanent: true },
      { source: "/products", destination: "/", permanent: true },
      { source: "/products/:path*", destination: "/", permanent: true },
      { source: "/enterprise", destination: "/", permanent: true },
      { source: "/eval", destination: "/", permanent: true },
      { source: "/for-hiring-teams", destination: "/", permanent: true },
      { source: "/schools", destination: "/", permanent: true },
      { source: "/homeschool", destination: "/", permanent: true },
      { source: "/certify", destination: "/", permanent: true },
      { source: "/solutions", destination: "/", permanent: true },
      { source: "/solutions/:path*", destination: "/", permanent: true },
      { source: "/plan/:id", destination: "/workspace/:id", permanent: true },
      { source: "/plans", destination: "/workspaces", permanent: true },
      { source: "/vision", destination: "/science", permanent: true },
      { source: "/science/knowledge-tomography", destination: "/science", permanent: true },
      { source: "/science/think-aloud-protocol", destination: "/science", permanent: true },
      { source: "/learning-harness", destination: "/verify-protocols", permanent: true },
      { source: "/acquisition", destination: "/verify-protocols", permanent: true },
      { source: "/knowledge-verification", destination: "/verify-protocols", permanent: true },
      { source: "/knowledge-mapping", destination: "/verify-protocols", permanent: true },
      { source: "/solve-protocols", destination: "/verify-protocols", permanent: true },
      { source: "/mapping-protocols", destination: "/verify-protocols", permanent: true },
      { source: "/marketing/lp-variants", destination: "/", permanent: true },
      { source: "/pricing/verification", destination: "/pricing", permanent: true },
      { source: "/pricing/mapping", destination: "/pricing", permanent: true },
      { source: "/pricing/authoring", destination: "https://academy-k.com/", permanent: true },
      { source: "/tap/session/:token", destination: "/verify/session/:token", permanent: true },
      { source: "/calibrate/session/:token", destination: "/verify/session/:token", permanent: true },
      { source: "/ile/session/:token", destination: "/learn/session/:token", permanent: true },
      {
        source: "/ile/session/:token/settings",
        destination: "/learn/session/:token/settings",
        permanent: true,
      },
      { source: "/api/ile/:path*", destination: "/api/learn/:path*", permanent: true },
      {
        source: "/api/workspace-ile/:path*",
        destination: "/api/workspace-learn/:path*",
        permanent: true,
      },
      {
        source: "/api/calibrate/session/:path*",
        destination: "/api/verify/session/:path*",
        permanent: true,
      },
      { source: "/_pitch", destination: "/pitch", permanent: false },
      { source: "/_pitch.pdf", destination: "/pitch.pdf", permanent: false },
      { source: "/pitch-product", destination: "/pitch", permanent: true },
      { source: "/pitch-product.pdf", destination: "/pitch.pdf", permanent: true },
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