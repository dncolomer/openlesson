"use client";

import type { ReactNode } from "react";
import {
  Activity,
  MessageCircle,
  Monitor,
  Video,
  Wrench,
} from "lucide-react";
import type { IlePowDisplayCounterType } from "@/lib/ile-pow-counters";

export const ILE_POW_COUNTER_ICONS: Record<IlePowDisplayCounterType, ReactNode> = {
  tool: <Wrench className="size-3.5" strokeWidth={2.2} aria-hidden />,
  screen: <Monitor className="size-3.5" strokeWidth={2.2} aria-hidden />,
  video: <Video className="size-3.5" strokeWidth={2.2} aria-hidden />,
  eeg: <Activity className="size-3.5" strokeWidth={2.2} aria-hidden />,
  thoughts: <MessageCircle className="size-3.5" strokeWidth={2.2} aria-hidden />,
};

export function IlePowTypeIcon({
  type,
  className = "size-3.5",
}: {
  type: IlePowDisplayCounterType;
  className?: string;
}) {
  const stroke = 2.2;
  switch (type) {
    case "tool":
      return <Wrench className={className} strokeWidth={stroke} aria-hidden />;
    case "screen":
      return <Monitor className={className} strokeWidth={stroke} aria-hidden />;
    case "video":
      return <Video className={className} strokeWidth={stroke} aria-hidden />;
    case "eeg":
      return <Activity className={className} strokeWidth={stroke} aria-hidden />;
    case "thoughts":
      return <MessageCircle className={className} strokeWidth={stroke} aria-hidden />;
  }
}
