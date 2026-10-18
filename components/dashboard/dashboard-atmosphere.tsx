import { PUBLIC_MAGI_GRID_CLASS, PublicConsoleWash } from "@/components/ui/console-frame";

/** Dark grey field + the landing-page MAGI wash (fine grid, constellation, 72px overlay). */

export const DASHBOARD_FIELD = "#1a1a1a";

export function DashboardAtmosphere() {
  return (
    <>
      <div
        data-dashboard-atmosphere=""
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ backgroundColor: DASHBOARD_FIELD }}
      />
      <PublicConsoleWash className="absolute inset-0 z-0" />
      <div
        aria-hidden
        data-dashboard-atmosphere-grid=""
        className={`pointer-events-none absolute inset-0 z-0 ${PUBLIC_MAGI_GRID_CLASS}`}
      />
    </>
  );
}
