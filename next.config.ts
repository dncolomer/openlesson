import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Isolated dist dir for parallel `next dev` (e.g. pilot servers) without fighting .next/dev/lock
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // A package-lock.json in the parent UncertainSystems folder otherwise becomes
  // the Turbopack workspace root, and CSS cannot resolve tailwindcss.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  serverExternalPackages: [
    "@coral-xyz/anchor",
  ],
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
      {
        source: "/docs/proof-of-work-api",
        destination: "/docs/learning-map-api",
        permanent: true,
      },
      {
        source: "/docs/proof-of-work-api/:path*",
        destination: "/docs/learning-map-api/:path*",
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
      { source: "/learning-harness", destination: "/acquisition", permanent: true },
      { source: "/marketing/lp-variants", destination: "/", permanent: true },
      { source: "/pricing/verification", destination: "/pricing", permanent: true },
      { source: "/pricing/mapping", destination: "/pricing", permanent: true },
      { source: "/pricing/authoring", destination: "https://academy-k.com/", permanent: true },
      { source: "/ile/session/:token", destination: "/learn/session/:token", permanent: true },
      {
        source: "/ile/session/:token/settings",
        destination: "/learn/session/:token/settings",
        permanent: true,
      },
      { source: "/api/ile/:path*", destination: "/api/learn/:path*", permanent: true },
      {
        source: "/api/workspace-ile/:path*",
        destination: "/api/solve/session/:path*",
        permanent: true,
      },
      {
        source: "/api/workspace-learn/:path*",
        destination: "/api/solve/session/:path*",
        permanent: true,
      },
      {
        source: "/api/solve-flow/public/:token",
        destination: "/api/solve/public/:token",
        permanent: true,
      },
      {
        source: "/api/solve-flow/public/:token/:path*",
        destination: "/api/solve/public/:token/:path*",
        permanent: true,
      },
      {
        source: "/api/v3/pow/keys",
        destination: "/api/dashboard/api-keys",
        permanent: true,
      },
      {
        source: "/api/v3/pow/keys/:path*",
        destination: "/api/dashboard/api-keys/:path*",
        permanent: true,
      },
      {
        source: "/api/workspace/ile-links",
        destination: "/api/workspace/learn-links",
        permanent: true,
      },
      {
        source: "/workspace/:id/scout",
        destination: "/workspace/:id/calibrate",
        permanent: true,
      },
      {
        source: "/workspace/:id/tap",
        destination: "/workspace/:id/verify",
        permanent: true,
      },
      { source: "/_pitch", destination: "/pitch", permanent: false },
      { source: "/_pitch.pdf", destination: "/pitch.pdf", permanent: false },
    ];
  },
  async rewrites() {
    return [{ source: "/pitch", destination: "/pitch.pdf" }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xzwjlkngxuxttvqbboea.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;