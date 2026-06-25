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
        destination: "/docs/agentic-v2",
        permanent: true,
      },
      { source: "/enterprise", destination: "/solutions/sales-enablement", permanent: true },
      { source: "/eval", destination: "/solutions/hiring-assessment", permanent: true },
      { source: "/for-hiring-teams", destination: "/solutions/hiring-assessment", permanent: true },
      { source: "/schools", destination: "/solutions/lms-integration", permanent: true },
      { source: "/homeschool", destination: "/solutions/corporate-learning", permanent: true },
      { source: "/certify", destination: "/solutions/corporate-learning", permanent: true },
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
