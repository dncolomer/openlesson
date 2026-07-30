import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

/**
 * Backward-compat: old share URLs used `/practice-portal/{token}`.
 * Canonical public path is `/portal/{token}`.
 */
export default async function PracticePortalLegacyRedirect({ params }: PageProps) {
  const { token: rawToken } = await params;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!token) {
    redirect("/portal/");
  }
  redirect(`/portal/${encodeURIComponent(token)}`);
}
