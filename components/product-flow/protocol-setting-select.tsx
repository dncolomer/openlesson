"use client";

import { useEffect, useState } from "react";
import { withOrganizationId } from "@/lib/organization/active-organization-client";
import {
  parseProtocolSettingId,
  presentProtocolSetting,
  type ProtocolSettingRecord,
} from "@/lib/organization/protocol-settings";
import { FLOW_FORM_INPUT, FlowField } from "@/components/product-flow/product-flow-form";
import {
  EMPTY_SESSION_SIDEBAR_STYLE,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

export function ProtocolSettingSelect({
  value,
  onChange,
  onStyleChange,
  disabled,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  onStyleChange?: (style: SessionSidebarStyle) => void;
  disabled?: boolean;
}) {
  const [settings, setSettings] = useState<ProtocolSettingRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(withOrganizationId("/api/organization/protocol-settings"))
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        const rows = Array.isArray(body.settings)
          ? body.settings.map((row: Record<string, unknown>) => presentProtocolSetting(row))
          : [];
        setSettings(rows);
      })
      .catch(() => {
        if (!cancelled) setSettings([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!onStyleChange) return;
    const selectedId = parseProtocolSettingId(value);
    const row = selectedId
      ? settings.find((setting) => setting.id === selectedId)
      : settings.find((setting) => setting.isDefault) ?? settings[0];
    onStyleChange(row?.style ?? EMPTY_SESSION_SIDEBAR_STYLE);
  }, [onStyleChange, settings, value]);

  const selected = parseProtocolSettingId(value) ?? "";

  return (
    <FlowField label="Protocol settings">
      <select
        value={selected}
        disabled={disabled || !loaded}
        data-flow-protocol-setting=""
        onChange={(event) => onChange(parseProtocolSettingId(event.target.value))}
        className={FLOW_FORM_INPUT}
      >
        <option value="">Default</option>
        {settings.map((row) =>
          row.id ? (
            <option key={row.id} value={row.id}>
              {row.name}
              {row.isDefault ? " (org default)" : ""}
            </option>
          ) : null,
        )}
      </select>
      <p className="mt-1 text-xs text-neutral-500">
        Default follows the organization default if that setting changes later.
      </p>
    </FlowField>
  );
}
