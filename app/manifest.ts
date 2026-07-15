import type { MetadataRoute } from "next";
import { BRAND_LOGO_PATH } from "../lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Uncertain Systems",
    short_name: "Uncertain Systems",
    description:
      "Learning efficiency for humans and agents — Proof-of-Work API, Think Aloud Protocol, ILE, and ALE on Workspaces.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: BRAND_LOGO_PATH,
        sizes: "1024x1024",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: BRAND_LOGO_PATH,
        sizes: "1024x1024",
        type: "image/jpeg",
        purpose: "maskable",
      },
    ],
  };
}
