"use client";

import { useEffect, useState } from "react";
import { PUBLIC_FIELD_STILLS } from "@/components/ui/console-frame";

/** Ink navy between black plates and blueprint stills. No MAGI grid and no Accelerando wash. */
export const DASHBOARD_FIELD = "#0e1c2c";

export function DashboardAtmosphere() {
  const [still, setStill] = useState("");

  useEffect(() => {
    setStill(PUBLIC_FIELD_STILLS[Math.floor(Math.random() * PUBLIC_FIELD_STILLS.length)]);
  }, []);

  return (
    <div
      data-dashboard-atmosphere=""
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[#0e1c2c]" />
      {still ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${still})` }}
        />
      ) : null}
      <div className="absolute inset-0 bg-[#0e1c2c]/78" />
    </div>
  );
}
