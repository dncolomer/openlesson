import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ThesisDirectory } from "@/components/science/ThesisDirectory";
import { MARKETING_SHELL } from "@/lib/marketing/shell";
import type { ThesisDeepLink } from "@/lib/science/hub";

export const MARKETING_HERO_PRIMARY_CTA_CLASS =
  "inline-flex min-h-12 items-center justify-center rounded-none bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200";

export const MARKETING_HERO_SECONDARY_CTA_CLASS =
  "inline-flex min-h-12 items-center justify-center rounded-none border border-zinc-800 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white";

export function MarketingDirectoryHero({
  eyebrows,
  title,
  children,
  actions,
  directoryEyebrow,
  directoryTitle,
  directoryLead,
  directoryHeadingId,
  links,
  marker,
  ...sectionProps
}: {
  eyebrows: readonly string[];
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  directoryEyebrow?: string;
  directoryTitle?: string;
  directoryLead?: string;
  directoryHeadingId?: string;
  links: readonly ThesisDeepLink[];
  marker: string;
} & Omit<ComponentPropsWithoutRef<"section">, "children" | "title">) {
  return (
    <section
      className={`${MARKETING_SHELL} pt-5 pb-3 sm:pt-6`}
      data-marketing-directory-hero
      {...sectionProps}
    >
      <div className="console-copy overflow-hidden">
        <div className="grid lg:grid-cols-12">
          <div className="flex flex-col p-5 sm:p-6 lg:col-span-7 lg:p-7">
            {eyebrows.length > 0 ? (
              <div className="mb-4 flex flex-wrap items-center gap-3">
                {eyebrows.map((eyebrow) => (
                  <div
                    key={eyebrow}
                    className="console-chip inline-block rounded-none px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500"
                  >
                    {eyebrow}
                  </div>
                ))}
              </div>
            ) : null}
            <h1 className="text-[1.75rem] font-medium leading-[1.08] tracking-[-1px] text-white sm:text-5xl sm:tracking-[-2px] lg:text-6xl">
              {title}
            </h1>
            {children ? (
              <div className="mt-5 space-y-3 text-base leading-relaxed text-zinc-400 sm:text-lg">
                {children}
              </div>
            ) : null}
            {actions ? (
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">{actions}</div>
            ) : null}
          </div>
          <div
            className="border-t border-zinc-800/90 p-5 sm:p-6 lg:col-span-5 lg:border-t-0 lg:border-l"
            {...(directoryHeadingId ? { "aria-labelledby": directoryHeadingId } : {})}
          >
            {directoryEyebrow ? (
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                {directoryEyebrow}
              </p>
            ) : null}
            {directoryTitle ? (
              <h2
                id={directoryHeadingId}
                className={`text-lg font-medium tracking-[-0.4px] text-white ${
                  directoryEyebrow ? "mt-2" : ""
                }`}
              >
                {directoryTitle}
              </h2>
            ) : null}
            {directoryLead ? (
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{directoryLead}</p>
            ) : null}
            <div className={directoryEyebrow || directoryTitle || directoryLead ? "mt-2" : ""}>
              <ThesisDirectory
                links={links}
                marker={marker}
                columns="grid-cols-1"
                tone="index"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
