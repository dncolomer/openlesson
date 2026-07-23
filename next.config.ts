import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent @huggingface/transformers from being bundled server-side
  serverExternalPackages: [
    "@huggingface/transformers",
    "onnxruntime-web",
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
        destination: "/docs/proof-of-work-api",
        permanent: true,
      },
      {
        source: "/docs/agentic-v2",
        destination: "/docs/proof-of-work-api",
        permanent: true,
      },
      // Former /platform marketing path must not redirect to deleted /use-cases.
      // Nav "Platform" uses client hash /#platform on home — server redirects stay path-only.
      { source: "/platform", destination: "/", permanent: true },
      { source: "/use-cases", destination: "/", permanent: true },
      { source: "/use-cases/:path*", destination: "/", permanent: true },
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
      { source: "/admin/plans", destination: "/admin/workspaces", permanent: true },
      { source: "/admin/plans/:id", destination: "/admin/workspaces/:id", permanent: true },
    ];
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