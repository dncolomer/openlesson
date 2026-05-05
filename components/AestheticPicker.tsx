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
}

export function AestheticPicker({
  packages,
  selectedId,
  onSelect,
  disabled = false,
  loading = false,
  compact = false,
}: AestheticPickerProps) {
  const { t } = useI18n();

  return (
    <div className="mb-4">
      <div className="flex items-end justify-between gap-3 mb-2">
        <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          {t("session.aesthetics")}
        </label>
        {loading && <span className="text-[11px] text-neutral-600">{t("session.aestheticsLoading")}</span>}
      </div>

      {packages.length > 0 ? (
        <div className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-3"}`}>
          {packages.map((pkg) => {
            const selected = selectedId === pkg.id;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => onSelect(pkg.id)}
                disabled={disabled}
                className={`group overflow-hidden rounded-xl border bg-neutral-900 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  selected
                    ? "border-neutral-200 ring-1 ring-neutral-200/40"
                    : "border-neutral-800 hover:border-neutral-600"
                }`}
              >
                <div className="relative h-16 bg-neutral-950 overflow-hidden">
                  <img
                    src={pkg.previewImage}
                    alt=""
                    className="w-full h-full object-cover opacity-80 transition-transform group-hover:scale-105"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
                <div className="px-2.5 py-2">
                  <span className="block text-xs font-medium text-neutral-200 truncate">{pkg.name}</span>
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
