/**
 * Shared public-marketing column. Homepage and product pages share this
 * so large screens fill without stretching copy edge-to-edge, and phones
 * keep a short gutter. Dashboard chrome does not use this.
 */
export const MARKETING_SHELL =
  "relative z-10 mx-auto w-full max-w-[96rem] px-4 sm:px-6 xl:px-8";

export const MARKETING_SHELL_INNER =
  "mx-auto w-full max-w-[96rem] px-4 sm:px-6 xl:px-8";

/** Letterbox behind object-contain marketing stills. Matches the regions/chart navy. */
export const MARKETING_MEDIA_FILL_CLASS = "bg-[#07111f]";

/** Tall stage so 16:9 diagrams render large instead of letterboxing in a short cell. */
export const MARKETING_MEDIA_STAGE_CLASS =
  "relative min-h-[20rem] flex-1 sm:min-h-[26rem] lg:min-h-[32rem] xl:min-h-[36rem]";
