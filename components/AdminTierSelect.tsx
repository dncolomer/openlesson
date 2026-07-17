"use client";

import { ADMIN_TIER_OPTIONS, type AdminTierId } from "@/lib/admin/tiers";

interface AdminTierSelectProps {
  value: AdminTierId | null;
  lockedLabel?: string;
  disabled?: boolean;
  onChange: (tier: AdminTierId) => void;
  className?: string;
}

export function AdminTierSelect({
  value,
  lockedLabel,
  disabled,
  onChange,
  className = "",
}: AdminTierSelectProps) {
  if (lockedLabel) {
    return (
      <span
        className={`inline-flex items-center rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200 ${className}`}
        title="Locked tier label"
      >
        {lockedLabel}
      </span>
    );
  }

  return (
    <select
      value={value ?? "inactive"}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as AdminTierId)}
      className={className}
    >
      {ADMIN_TIER_OPTIONS.map((tier) => (
        <option key={tier.id} value={tier.id}>
          {tier.label}
        </option>
      ))}
    </select>
  );
}