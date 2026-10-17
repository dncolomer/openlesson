import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyIleSettingsRedirect({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") sp.set(key, value);
    else if (Array.isArray(value)) for (const item of value) sp.append(key, item);
  }
  const qs = sp.toString();
  redirect(`/learn/session/${token}/settings${qs ? `?${qs}` : ""}`);
}
