import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "openLesson",
    short_name: "openLesson",
    description:
      "Learning efficiency for humans and agents — Evidence API, Think Aloud Protocol, ILE, and ALE on Verification Workspaces.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/new_logo.jpg",
        sizes: "1024x1024",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/new_logo.jpg",
        sizes: "1024x1024",
        type: "image/jpeg",
        purpose: "maskable",
      },
    ],
  };
}
