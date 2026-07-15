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
        destination: "/new_logo.jpg",
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
      { source: "/platform", destination: "/use-cases", permanent: true },
      { source: "/enterprise", destination: "/use-cases/learning-verification", permanent: true },
      { source: "/eval", destination: "/use-cases/learning-verification", permanent: true },
      { source: "/for-hiring-teams", destination: "/use-cases/learning-verification", permanent: true },
      { source: "/schools", destination: "/use-cases/reasoning-augmentation", permanent: true },
      { source: "/homeschool", destination: "/use-cases/reasoning-augmentation", permanent: true },
      { source: "/certify", destination: "/use-cases/reasoning-augmentation", permanent: true },
      { source: "/solutions", destination: "/use-cases", permanent: true },
      { source: "/solutions/:path*", destination: "/use-cases", permanent: true },
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