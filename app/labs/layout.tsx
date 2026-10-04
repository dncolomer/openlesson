"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { ConsolePage } from "@/components/ui/console-frame";

export default function LabsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: unknown } }) => {
      if (!data.user) {
        router.push("/login?redirect=/labs");
      } else {
        setLoading(false);
      }
    });
  }, [supabase, router]);

  if (loading) {
    return (
      <ConsolePage label="Labs">
        <div className="flex flex-1 items-center justify-center">
          <LoadingStatusMessage message="Loading" />
        </div>
      </ConsolePage>
    );
  }

  return (
    <ConsolePage label="Labs">
      <Navbar breadcrumbs={[{ label: "Labs" }]} />
      <main className="min-h-0 flex-1 bg-black">
        {children}
      </main>
    </ConsolePage>
  );
}