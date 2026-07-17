"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";

/** Legacy route — organization lives on Dashboard → Organization tab. */
export default function OrganizationRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard?tab=organization");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <LoadingStatusMessage message="Opening organization…" />
    </div>
  );
}
