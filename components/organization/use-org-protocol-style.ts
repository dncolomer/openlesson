"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { readCustomAestheticUrls } from "@/lib/organization/custom-aesthetic-set";
import {
  fileToAestheticPayload,
  validateAestheticFile,
} from "@/lib/organization/custom-aesthetics-client";
import { ORGANIZATION_SWITCHED_EVENT } from "@/lib/organization/membership";
import {
  presentProtocolSetting,
  type ProtocolSettingRecord,
} from "@/lib/organization/protocol-settings";
import {
  EMPTY_SESSION_SIDEBAR_STYLE,
  parseSessionCanvasStyle,
  parseSessionSidebarStyle,
  type SessionCanvasStyle,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

function apiErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const err = (body as { error?: unknown }).error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}

function stylePath(settingId: string): string {
  const id = settingId.trim() || "default";
  return `/api/organization/protocol-settings/${encodeURIComponent(id)}/style`;
}

export function useOrgProtocolStyle() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [hasOrganization, setHasOrganization] = useState(false);
  const [tableAvailable, setTableAvailable] = useState(true);
  const [settings, setSettings] = useState<ProtocolSettingRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [aestheticUrls, setAestheticUrls] = useState<string[]>([]);
  const [sidebarStyle, setSidebarStyle] = useState<SessionSidebarStyle>(EMPTY_SESSION_SIDEBAR_STYLE);
  const [sidebarPrompt, setSidebarPrompt] = useState("");
  const [stylingSidebar, setStylingSidebar] = useState(false);
  const [uploadingAesthetics, setUploadingAesthetics] = useState(false);
  const [removingAestheticUrl, setRemovingAestheticUrl] = useState<string | null>(null);
  const [mutatingSettings, setMutatingSettings] = useState(false);

  const selected =
    settings.find((row) => row.id === selectedId) ??
    settings.find((row) => row.isDefault) ??
    settings[0] ??
    null;

  const applySetting = (setting: ProtocolSettingRecord | null) => {
    if (!setting) {
      setSidebarStyle(EMPTY_SESSION_SIDEBAR_STYLE);
      setSidebarPrompt("");
      return;
    }
    setSelectedId(setting.id);
    setSidebarStyle(setting.style);
    setSidebarPrompt(setting.style.prompt);
  };

  const applyList = (rows: unknown, preferredId?: string) => {
    const next = Array.isArray(rows)
      ? rows.map((row) => presentProtocolSetting(row as Record<string, unknown>))
      : [];
    setSettings(next);
    const preferred =
      next.find((row) => row.id === preferredId) ??
      next.find((row) => row.id === selectedId) ??
      next.find((row) => row.isDefault) ??
      next[0] ??
      null;
    applySetting(preferred);
  };

  const applyAestheticsPayload = (data: {
    images?: unknown;
    style?: unknown;
    setting?: unknown;
  }) => {
    if (data.images) setAestheticUrls(readCustomAestheticUrls(data.images));
    if (data.setting && typeof data.setting === "object") {
      const setting = presentProtocolSetting(data.setting as Record<string, unknown>);
      setSettings((current) => {
        const without = current.filter((row) => row.id !== setting.id);
        return [...without, setting].sort((a, b) => {
          if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      });
      applySetting(setting);
      return;
    }
    if (data.style) {
      const next = parseSessionSidebarStyle(data.style);
      setSidebarStyle(next);
      setSidebarPrompt(next.prompt);
    }
  };

  const loadOrganization = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/organization");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("organization.loadError"));
        setLoading(false);
        return;
      }

      setHasOrganization(Boolean(data.organization));
      setAestheticUrls(readCustomAestheticUrls(data.organization?.custom_aesthetic_urls));
      setIsOrgAdmin(Boolean(data.is_org_admin));
      if (!data.organization) {
        setSettings([]);
        applySetting(null);
        setError(null);
        setLoading(false);
        return;
      }

      const listed = await fetch("/api/organization/protocol-settings");
      const listedBody = await listed.json().catch(() => ({}));
      if (!listed.ok) {
        const fallback = parseSessionSidebarStyle(data.organization?.sidebar_style);
        setSidebarStyle(fallback);
        setSidebarPrompt(fallback.prompt);
        setSettings([]);
        setError(listedBody.error || t("organization.loadError"));
        setLoading(false);
        return;
      }
      setTableAvailable(listedBody.table_available !== false);
      applyList(listedBody.settings);
      setError(null);
    } catch (err) {
      console.error("Load protocol settings error:", err);
      setError(t("organization.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrganization();
    window.addEventListener(ORGANIZATION_SWITCHED_EVENT, loadOrganization);
    return () => {
      window.removeEventListener(ORGANIZATION_SWITCHED_EVENT, loadOrganization);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAestheticUpload = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    for (const file of list) {
      const err = validateAestheticFile(file);
      if (err) {
        alert(err);
        return;
      }
    }
    setUploadingAesthetics(true);
    try {
      const images = await Promise.all(list.map((file) => fileToAestheticPayload(file)));
      const res = await fetch("/api/organization/aesthetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(apiErrorMessage(data, t("organization.aestheticUploadError")));
        return;
      }
      applyAestheticsPayload(data);
    } catch (uploadErr) {
      console.error("Custom aesthetic upload error:", uploadErr);
      alert(t("organization.aestheticUploadError"));
    } finally {
      setUploadingAesthetics(false);
    }
  };

  const handleRemoveAesthetic = async (url: string) => {
    setRemovingAestheticUrl(url);
    try {
      const res = await fetch("/api/organization/aesthetics", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(apiErrorMessage(data, t("organization.aestheticRemoveError")));
        return;
      }
      applyAestheticsPayload(data);
    } catch (removeErr) {
      console.error("Custom aesthetic remove error:", removeErr);
      alert(t("organization.aestheticRemoveError"));
    } finally {
      setRemovingAestheticUrl(null);
    }
  };

  const handleStyleSidebar = async () => {
    const prompt = sidebarPrompt.trim();
    if (!prompt) return;
    setStylingSidebar(true);
    try {
      const res = await fetch(stylePath(selected?.id || "default"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(apiErrorMessage(data, t("organization.sidebarStyleError")));
        return;
      }
      applyAestheticsPayload(data);
    } catch (styleErr) {
      console.error("Sidebar style error:", styleErr);
      alert(t("organization.sidebarStyleError"));
    } finally {
      setStylingSidebar(false);
    }
  };

  const handleCanvasStyle = async (canvas: SessionCanvasStyle) => {
    const nextCanvas = parseSessionCanvasStyle(canvas);
    setSidebarStyle((prev) => ({ ...prev, canvas: nextCanvas }));
    try {
      const res = await fetch(stylePath(selected?.id || "default"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvas: nextCanvas }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(apiErrorMessage(data, t("organization.sidebarStyleError")));
        return;
      }
      applyAestheticsPayload(data);
    } catch (canvasErr) {
      console.error("Canvas style error:", canvasErr);
      alert(t("organization.sidebarStyleError"));
    }
  };

  const handleResetSidebarStyle = async () => {
    setStylingSidebar(true);
    try {
      const res = await fetch(stylePath(selected?.id || "default"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(apiErrorMessage(data, t("organization.sidebarStyleError")));
        return;
      }
      applyAestheticsPayload(data);
      setSidebarPrompt("");
      setSidebarStyle(EMPTY_SESSION_SIDEBAR_STYLE);
    } catch (styleErr) {
      console.error("Sidebar style reset error:", styleErr);
      alert(t("organization.sidebarStyleError"));
    } finally {
      setStylingSidebar(false);
    }
  };

  const handleCreateSetting = async (name: string): Promise<ProtocolSettingRecord | null> => {
    setMutatingSettings(true);
    try {
      const res = await fetch("/api/organization/protocol-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(apiErrorMessage(data, t("organization.protocolSettingsCreateError")));
        return null;
      }
      const created = presentProtocolSetting(data.setting);
      setSettings((current) => [...current, created]);
      applySetting(created);
      return created;
    } catch (createErr) {
      console.error("Create protocol setting error:", createErr);
      alert(t("organization.protocolSettingsCreateError"));
      return null;
    } finally {
      setMutatingSettings(false);
    }
  };

  const handleRenameSetting = async (id: string, name: string) => {
    setMutatingSettings(true);
    try {
      const res = await fetch(`/api/organization/protocol-settings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(apiErrorMessage(data, t("organization.protocolSettingsSaveError")));
        return;
      }
      const updated = presentProtocolSetting(data.setting);
      setSettings((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      if (selectedId === updated.id) applySetting(updated);
    } catch (renameErr) {
      console.error("Rename protocol setting error:", renameErr);
      alert(t("organization.protocolSettingsSaveError"));
    } finally {
      setMutatingSettings(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    setMutatingSettings(true);
    try {
      const res = await fetch(`/api/organization/protocol-settings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(apiErrorMessage(data, t("organization.protocolSettingsSaveError")));
        return;
      }
      const updated = presentProtocolSetting(data.setting);
      setSettings((current) =>
        current.map((row) => ({
          ...row,
          isDefault: row.id === updated.id,
        })),
      );
    } catch (defaultErr) {
      console.error("Set default protocol setting error:", defaultErr);
      alert(t("organization.protocolSettingsSaveError"));
    } finally {
      setMutatingSettings(false);
    }
  };

  const handleDeleteSetting = async (id: string) => {
    if (!window.confirm(t("organization.protocolSettingsDeleteConfirm"))) return;
    setMutatingSettings(true);
    try {
      const res = await fetch(`/api/organization/protocol-settings/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(apiErrorMessage(data, t("organization.protocolSettingsDeleteError")));
        return;
      }
      const remaining = settings.filter((row) => row.id !== id);
      if (data.promoted) {
        const promoted = presentProtocolSetting(data.promoted);
        applyList(
          remaining.map((row) => (row.id === promoted.id ? promoted : { ...row, isDefault: false })),
          selectedId === id ? promoted.id : selectedId,
        );
      } else {
        applyList(remaining, selectedId === id ? undefined : selectedId);
      }
    } catch (deleteErr) {
      console.error("Delete protocol setting error:", deleteErr);
      alert(t("organization.protocolSettingsDeleteError"));
    } finally {
      setMutatingSettings(false);
    }
  };

  return {
    loading,
    error,
    isOrgAdmin,
    hasOrganization,
    tableAvailable,
    settings,
    selected,
    selectedId,
    selectSetting: (id: string) => {
      const next = settings.find((row) => row.id === id) ?? null;
      applySetting(next);
    },
    aestheticUrls,
    sidebarStyle,
    sidebarPrompt,
    setSidebarPrompt,
    stylingSidebar,
    uploadingAesthetics,
    removingAestheticUrl,
    mutatingSettings,
    handleAestheticUpload,
    handleRemoveAesthetic,
    handleStyleSidebar,
    handleCanvasStyle,
    handleResetSidebarStyle,
    handleCreateSetting,
    handleRenameSetting,
    handleSetDefault,
    handleDeleteSetting,
  };
}

export type OrgProtocolStyleController = ReturnType<typeof useOrgProtocolStyle>;
