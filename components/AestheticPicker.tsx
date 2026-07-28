"use client";

import { type AestheticPackage } from "@/lib/aesthetics";
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
}

export function AestheticPicker({
  packages,
  selectedId,
  onSelect,
  disabled = false,
  loading = false,
  compact = false,
  wide = false,
}: AestheticPickerProps) {
  const { t } = useI18n();

  return (
    <div className={wide ? "" : "mb-4"}>
      <div className="mb-2 flex items-end justify-between gap-3">
        <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          {t("session.aesthetics")}
        </label>
        {loading && <span className="text-[11px] text-neutral-600">{t("session.aestheticsLoading")}</span>}
      </div>

      {packages.length > 0 ? (
        <div
          className={`grid gap-2.5 ${
            compact ? "grid-cols-1" : wide ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3"
          }`}
        >
          {packages.map((pkg) => {
            const selected = selectedId === pkg.id;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => onSelect(pkg.id)}
                disabled={disabled}
                className={`group overflow-hidden rounded-xl border bg-neutral-950 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? "border-neutral-200 ring-1 ring-neutral-200/40"
                    : "border-neutral-800 hover:border-neutral-600"
                }`}
              >
                <div
                  className={`relative overflow-hidden bg-neutral-950 ${
                    wide ? "h-24 sm:h-28" : "h-16"
                  }`}
                >
                  <img
                    src={pkg.previewImage}
                    alt=""
                    className="h-full w-full object-cover opacity-80 transition-transform group-hover:scale-105"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
                <div className={`px-2.5 ${wide ? "py-2.5" : "py-2"}`}>
                  <span className="block truncate text-xs font-medium text-neutral-200">{pkg.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-xs text-neutral-500">
          {loading ? t("session.aestheticsLoading") : t("session.noAestheticsFound")}
        </div>
      )}
    </div>
  );
}
