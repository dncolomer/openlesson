/** Dark grey field + MAGI square grid under the dashboard console. */

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
      <div
        aria-hidden
        data-dashboard-atmosphere-grid=""
        className="pointer-events-none absolute inset-0 z-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />
    </>
  );
}
