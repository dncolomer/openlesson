export interface AestheticPackage {
  id: string;
  name: string;
  images: string[];
  previewImage: string;
}

export function formatAestheticName(id: string) {
  return id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function fetchAestheticPackages(): Promise<AestheticPackage[]> {
  const response = await fetch("/api/aesthetics", { cache: "no-store" });
  if (!response.ok) return [];
  const data = (await response.json()) as { packages?: AestheticPackage[] };
  return Array.isArray(data.packages) ? data.packages : [];
}
