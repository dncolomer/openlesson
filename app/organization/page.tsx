"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { ConsolePage } from "@/components/ui/console-frame";

/** Legacy route — organization lives on Dashboard → Organization tab. */
export default function OrganizationRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard?tab=organization");
  }, [router]);

  return (
    <ConsolePage label="Home">
      <div className="flex flex-1 items-center justify-center">
        <LoadingStatusMessage message="Opening organization…" />
      </div>
    </ConsolePage>
  );
}
