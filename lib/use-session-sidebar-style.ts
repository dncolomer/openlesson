"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fetchOrgAesthetics } from "@/lib/aesthetics";
import { ORGANIZATION_SWITCHED_EVENT } from "@/lib/organization/membership";
import {
  EMPTY_SESSION_SIDEBAR_STYLE,
  parseSessionSidebarStyle,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

const SessionSidebarStyleContext = createContext<SessionSidebarStyle | null>(null);

export function SessionSidebarStyleOverride({
  style,
  children,
}: {
  style: SessionSidebarStyle | null | undefined;
  children: ReactNode;
}) {
  return createElement(
    SessionSidebarStyleContext.Provider,
    { value: style ?? null },
    children,
  );
}

export function useSessionSidebarStyle(): SessionSidebarStyle {
  const override = useContext(SessionSidebarStyleContext);
  const [style, setStyle] = useState<SessionSidebarStyle>(EMPTY_SESSION_SIDEBAR_STYLE);
  useEffect(() => {
    if (override) return;
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
  }, [override]);
  return override ?? style;
}
