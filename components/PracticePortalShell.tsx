import type { ReactNode } from "react";

/**
 * Map-of-Knowledge visual shell for the public Practice Portal:
 * fixed aesthetics background, dark dimmer, cyan/zinc radials, centered content.
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
      <div
        className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.22),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.62),transparent_32%)]"
        data-practice-portal-aesthetics-overlay
        aria-hidden
      />

      <div
        className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-12 sm:px-6 sm:py-16"
        data-practice-portal-centered
      >
        {children}
      </div>
    </main>
  );
}
