"use client";

import { useEffect, useState } from "react";
import { fetchAestheticPackages, type AestheticPackage } from "@/lib/aesthetics";

export function useAestheticPackages() {
  const [aestheticPackages, setAestheticPackages] = useState<AestheticPackage[]>([]);
  const [aestheticsLoading, setAestheticsLoading] = useState(true);
  const [selectedAestheticId, setSelectedAestheticId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAestheticsLoading(true);
    fetchAestheticPackages()
      .then((packages) => {
        if (cancelled) return;
        setAestheticPackages(packages);
        setSelectedAestheticId((current) => current ?? packages[0]?.id ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setAestheticPackages([]);
      })
      .finally(() => {
        if (!cancelled) setAestheticsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAesthetic =
    aestheticPackages.find((pkg) => pkg.id === selectedAestheticId) ?? aestheticPackages[0];

  return {
    aestheticPackages,
    aestheticsLoading,
    selectedAestheticId,
    setSelectedAestheticId,
    selectedAesthetic,
  };
}
