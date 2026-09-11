"use client";

import { aestheticPackageVibe, type AestheticPackage } from "@/lib/aesthetics";
import { useI18n } from "@/lib/i18n";

interface AestheticPickerProps {
  packages: AestheticPackage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  /** Wider tiles + taller previews for horizontal welcome modal. */
  wide?: boolean;
  /** Stretch tiles to fill leftover pre-game column height. */
  fillHeight?: boolean;
}

export function AestheticPicker({
  packages,
  selectedId,
  onSelect,
  disabled = false,
  loading = false,
  compact = false,
  wide = false,
  fillHeight = false,
}: AestheticPickerProps) {
  const { t } = useI18n();
  const fill = fillHeight;

  return (
    <div
      data-ile-aesthetic-picker
      data-ile-aesthetic-fill={fillHeight ? "true" : "false"}
      className={fill ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden" : "mb-4"}
    >
      <div className="mb-2 flex shrink-0 items-end justify-between gap-3">
        <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          {t("session.aesthetics")}
        </label>
        {loading && <span className="text-[11px] text-neutral-600">{t("session.aestheticsLoading")}</span>}
      </div>

      {packages.length > 0 ? (
        <div
          className={`grid gap-3 ${
            fill
              ? "h-0 min-h-0 flex-1 auto-rows-fr grid-cols-1 overflow-y-auto overscroll-contain sm:grid-cols-2 xl:grid-cols-3"
              : compact
                ? "grid-cols-1"
                : wide
                  ? "grid-cols-2 sm:grid-cols-3"
                  : "grid-cols-3"
          }`}
        >
          {packages.map((pkg) => {
            const selected = selectedId === pkg.id;
            const vibe = aestheticPackageVibe(pkg.id);
            return (
              <button
                key={pkg.id}
                type="button"
                data-ile-aesthetic-option={pkg.id}
                aria-pressed={selected}
                onClick={() => onSelect(pkg.id)}
                disabled={disabled}
                className={`group flex min-h-0 flex-col overflow-hidden rounded-none border bg-neutral-950 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  fill ? "h-full min-h-[12rem]" : ""
                } ${
                  selected
                    ? "border-white ring-1 ring-white/40"
                    : "border-neutral-800 hover:border-neutral-500"
                }`}
              >
                <div
                  className={`relative min-h-0 overflow-hidden bg-neutral-950 ${
                    fill
                      ? "h-0 flex-1"
                      : wide
                        ? "h-24 sm:h-28"
                        : "h-16"
                  }`}
                >
                  <img
                    src={pkg.previewImage}
                    alt=""
                    className="h-full w-full object-cover opacity-90 transition-transform group-hover:scale-105"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                </div>
                <div className={`shrink-0 px-3 ${fill ? "py-3" : wide ? "py-2.5" : "px-2.5 py-2"}`}>
                  <span className="block truncate text-sm font-medium text-neutral-100">
                    {pkg.name}
                  </span>
                  <span
                    data-ile-aesthetic-vibe
                    className="mt-1 block text-[12px] leading-snug text-neutral-400 line-clamp-3"
                  >
                    {vibe}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-none border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-xs text-neutral-500">
          {loading ? t("session.aestheticsLoading") : t("session.noAestheticsFound")}
        </div>
      )}
    </div>
  );
}
