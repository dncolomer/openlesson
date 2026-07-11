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
        source: "/docs/agentic-v2-draft",
        destination: "/docs/proof-of-work-api",
        permanent: true,
      },
      {
        source: "/docs/agentic-v2",
        destination: "/docs/proof-of-work-api",
        permanent: true,
      },
      { source: "/enterprise", destination: "/platform", permanent: true },
      { source: "/eval", destination: "/platform", permanent: true },
      { source: "/for-hiring-teams", destination: "/platform", permanent: true },
      { source: "/schools", destination: "/platform", permanent: true },
      { source: "/homeschool", destination: "/platform", permanent: true },
      { source: "/certify", destination: "/platform", permanent: true },
      { source: "/solutions", destination: "/platform", permanent: true },
      { source: "/solutions/:path*", destination: "/platform", permanent: true },
      { source: "/prompts", destination: "/admin/prompts", permanent: false },
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