"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";

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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <LoadingStatusMessage message="Loading" />
      </div>
    );
  }

  return (
    <>
      <Navbar breadcrumbs={[{ label: "Labs" }]} />
      <main className="min-h-screen bg-[#0a0a0a]">
        {children}
      </main>
    </>
  );
}