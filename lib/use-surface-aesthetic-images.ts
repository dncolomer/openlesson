"use client";

import { useEffect, useState } from "react";
import {
  fetchAestheticPackages,
  selectSurfaceAestheticImages,
} from "@/lib/aesthetics";

/** Org-aware stills for dock chips and map tiles. Does not invent a folder pool before the listing returns. */
export function useSurfaceAestheticImages(provided?: readonly string[] | null): {
  images: readonly string[];
  source: "provided" | "packages" | "fallback" | "pending";
} {
  const hasProvided = Boolean(provided && provided.length > 0);
  const [fromPackages, setFromPackages] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    if (hasProvided) return;
    let cancelled = false;
    void fetchAestheticPackages()
      .then((packages) => {
        if (cancelled) return;
        setFromPackages(packages.flatMap((pkg) => pkg.images).filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) setFromPackages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [hasProvided]);

  return selectSurfaceAestheticImages({
    provided,
    fromPackages: hasProvided ? provided : fromPackages,
  });
}
