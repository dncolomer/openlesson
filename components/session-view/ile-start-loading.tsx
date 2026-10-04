"use client";

import { useEffect, useMemo, useState } from "react";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { SessionConsoleMarks } from "@/components/session-view/session-console-marks";
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

  const slot = String(index + 1).padStart(2, "0");
  const total = String(order.length).padStart(2, "0");

  return (
    <div data-ile-start-loading className="flex w-full max-w-2xl flex-col">
      <div className="relative border border-white/40 bg-black">
        <SessionConsoleMarks />
        <div className="relative z-[2] px-5 py-5 sm:px-7 sm:py-6">
          <LoadingStatusMessage message={t("session.startLoading")} className="text-left" size="sm" />
          <section
            data-ile-start-tips
            aria-roledescription="carousel"
            aria-label={t("session.startTipsTitle")}
            className="mt-6 border-t border-white/25 pt-5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/55">
                {t("session.startTipsTitle")}
              </p>
              <p
                data-ile-start-tip-index=""
                className="font-mono text-[10px] uppercase tracking-[0.22em] text-white"
              >
                {slot} / {total}
              </p>
            </div>
            <div className="mt-3 flex gap-1" aria-hidden="true">
              {order.map((id, markIndex) => (
                <span
                  key={id}
                  data-ile-start-tip-mark={id}
                  data-active={markIndex === index ? "true" : "false"}
                  className={
                    markIndex === index ? "h-1 flex-1 bg-white" : "h-1 flex-1 bg-white/20"
                  }
                />
              ))}
            </div>
            <p
              key={tipId}
              data-ile-start-tip={tipId}
              className="mt-5 border border-white/30 px-4 py-4 text-left font-mono text-sm leading-relaxed tracking-wide text-white sm:text-base"
            >
              {tip}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
