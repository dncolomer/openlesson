import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
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
    sitemap: "https://openlesson.academy/sitemap.xml",
  };
}
