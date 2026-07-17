import type { CSSProperties } from "react";

/** Shared admin UI tokens — aligned with Dashboard aesthetic treatment. */

export const ADMIN_BACKGROUND = "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg";

export const adminBackgroundStyle: CSSProperties = {
  backgroundImage: `linear-gradient(rgba(10,10,10,0.82), rgba(10,10,10,0.82)), url(${ADMIN_BACKGROUND})`,
};

/** Glass card used for panels, KPIs, tables. */
export const adminCardClass =
  "rounded-md border border-neutral-800 bg-neutral-950/75 backdrop-blur-sm";

export const adminCardPaddedClass = `${adminCardClass} p-5 sm:p-6`;

export const adminLabelClass =
  "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";

export const adminPageTitleClass =
  "text-2xl font-medium tracking-[-0.5px] text-white sm:text-3xl";

export const adminSectionTitleClass = "text-sm font-medium text-white";

export const adminInputClass =
  "w-full rounded-md border border-neutral-800 bg-neutral-950/60 px-4 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none";

export const adminSelectClass =
  "rounded-md border border-neutral-800 bg-neutral-950/60 px-4 py-2 text-sm text-white focus:border-neutral-600 focus:outline-none";

export const adminBtnClass =
  "rounded-md border border-neutral-800 bg-neutral-950/60 px-4 py-2 text-sm text-white transition-colors hover:border-neutral-700 disabled:cursor-not-allowed disabled:opacity-50";

export const adminPrimaryBtnClass =
  "inline-flex h-10 items-center justify-center rounded-sm bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50";

export const adminDangerBtnClass =
  "rounded-md border border-red-900/40 bg-red-950/40 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-950/60";

export const adminTableHeadClass =
  "border-b border-neutral-800 text-left font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500";

export const adminTableCellClass = "px-4 py-3 text-sm";

export const adminBackLinkClass =
  "mb-4 inline-block text-sm text-neutral-400 transition-colors hover:text-white";

export const adminPillClass =
  "rounded bg-neutral-800/80 px-1.5 py-0.5 text-xs text-neutral-300";

export const adminItemClass =
  "rounded-md border border-neutral-800/80 bg-neutral-900/40 p-3 transition-colors hover:bg-neutral-900/70";
