import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/session",
          "/results",
          "/login",
          "/register",
          "/plans",
          "/workspaces",
          "/api/",
        ],
      },
    ],
    sitemap: "https://uncertain.systems/sitemap.xml",
  };
}
