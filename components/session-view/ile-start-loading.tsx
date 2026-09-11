"use client";

import { useEffect, useMemo, useState } from "react";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import type { SessionViewTranslate } from "@/components/session-view/types";
import {
  ILE_START_TIP_IDS,
  ILE_START_TIP_INTERVAL_MS,
  ILE_START_TIP_LABEL_KEYS,
  nextIleStartTipIndex,
  shuffleIleStartTipIds,
} from "@/lib/ile-pregame-settings";

export function IleStartLoading({ t }: { t: SessionViewTranslate }) {
  const order = useMemo(() => shuffleIleStartTipIds(), []);
  const [index, setIndex] = useState(0);
  const tipId = order[index] ?? ILE_START_TIP_IDS[0];
  const tip = t(ILE_START_TIP_LABEL_KEYS[tipId]);

  useEffect(() => {
    if (order.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => nextIleStartTipIndex(current, order.length));
    }, ILE_START_TIP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [order.length]);

  return (
    <div
      data-ile-start-loading
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-10 px-6 py-10"
    >
      <LoadingStatusMessage
        message={t("session.startLoading")}
        className="text-center"
      />
      <section
        data-ile-start-tips
        aria-roledescription="carousel"
        aria-label={t("session.startTipsTitle")}
        className="w-full max-w-xl"
      >
        <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">
          {t("session.startTipsTitle")}
        </p>
        <p
          key={tipId}
          data-ile-start-tip={tipId}
          className="text-center text-[15px] leading-relaxed text-neutral-200"
        >
          {tip}
        </p>
      </section>
    </div>
  );
}
