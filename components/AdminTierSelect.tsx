"use client";

import { ADMIN_TIER_OPTIONS, type AdminTierId } from "@/lib/admin/tiers";

interface AdminTierSelectProps {
  value: AdminTierId;
  disabled?: boolean;
  onChange: (tier: AdminTierId) => void;
  className?: string;
}

export function AdminTierSelect({ value, disabled, onChange, className = "" }: AdminTierSelectProps) {
  return (
    <select
      value={value}
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