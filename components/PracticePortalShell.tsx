import type { ReactNode } from "react";
import { PublicConsoleWash } from "@/components/ui/console-frame";

/**
 * Map-of-Knowledge visual shell for the public Practice Portal:
 * fixed aesthetics background, dark dimmer, console grid, centered content.
 */
export function PracticePortalShell({
  backgroundImage,
  children,
  errorCode,
}: {
  /** Public path under `/aesthetics/…` */
  backgroundImage: string;
  children: ReactNode;
  errorCode?: string;
}) {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700"
      data-practice-portal-page
      data-practice-portal-shell
      {...(errorCode ? { "data-practice-portal-error": errorCode } : {})}
    >
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" aria-hidden />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${backgroundImage})` }}
        data-practice-portal-aesthetics-bg
        data-aesthetics-bg={backgroundImage}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" aria-hidden />
      <PublicConsoleWash data-practice-portal-aesthetics-overlay />
      <div
        className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-12 sm:px-6 sm:py-16"
        data-practice-portal-centered
      >
        {children}
      </div>
    </main>
  );
}
