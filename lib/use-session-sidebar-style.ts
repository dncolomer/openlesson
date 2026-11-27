"use client";

import { useEffect, useState } from "react";
import { fetchOrgAesthetics } from "@/lib/aesthetics";
import { ORGANIZATION_SWITCHED_EVENT } from "@/lib/organization/membership";
import {
  EMPTY_SESSION_SIDEBAR_STYLE,
  parseSessionSidebarStyle,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

export function useSessionSidebarStyle(): SessionSidebarStyle {
  const [style, setStyle] = useState<SessionSidebarStyle>(EMPTY_SESSION_SIDEBAR_STYLE);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchOrgAesthetics()
        .then((payload) => {
          if (!cancelled) setStyle(parseSessionSidebarStyle(payload.sidebarStyle));
        })
        .catch(() => {
          if (!cancelled) setStyle(EMPTY_SESSION_SIDEBAR_STYLE);
        });
    };
    load();
    window.addEventListener(ORGANIZATION_SWITCHED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(ORGANIZATION_SWITCHED_EVENT, load);
    };
  }, []);
  return style;
}
