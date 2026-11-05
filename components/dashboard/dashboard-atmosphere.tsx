/** Dark grey field. No MAGI grid and no Accelerando wash. */

export const DASHBOARD_FIELD = "#1a1a1a";

export function DashboardAtmosphere() {
  return (
    <div
      data-dashboard-atmosphere=""
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0"
      style={{ backgroundColor: DASHBOARD_FIELD }}
    />
  );
}
