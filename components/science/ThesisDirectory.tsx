import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ThesisDeepLink } from "@/lib/science/hub";

export function ThesisDirectory({
  links,
  marker,
  columns = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  links: readonly ThesisDeepLink[];
  marker: string;
  columns?: string;
}) {
  return (
    <nav
      data-thesis-directory={marker}
      aria-label="Thesis"
      className={`grid gap-3 ${columns}`}
    >
      {links.map((link) => {
        const inner = (
          <>
            <span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                {link.hint}
              </span>
              <span className="mt-1.5 block text-sm font-medium text-zinc-100 group-hover:text-white sm:text-[15px]">
                {link.label}
              </span>
            </span>
            <ArrowRight
              size={14}
              className="mt-1 shrink-0 text-zinc-500 transition group-hover:text-white"
              aria-hidden
            />
          </>
        );
        const className =
          "console-copy group flex items-start justify-between gap-3 p-4 transition hover:border-white/80 sm:p-5";
        // Same-page hashes: native anchors jump. Next Link often no-ops.
        if (link.href.startsWith("#")) {
          return (
            <a key={`${link.href}-${link.label}`} href={link.href} className={className}>
              {inner}
            </a>
          );
        }
        return (
          <Link key={`${link.href}-${link.label}`} href={link.href} className={className}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
