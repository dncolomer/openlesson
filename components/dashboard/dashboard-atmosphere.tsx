/** Dim still + field grid under the dashboard console. Scan/marks stay on the page shell. */

export const DASHBOARD_STILL =
  "/aesthetics/piotr-binkowski/HGHQJOtWgAAOGtm.jpeg";

export function DashboardAtmosphere() {
  return (
    <>
      <div
        data-dashboard-atmosphere=""
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${DASHBOARD_STILL})` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-black/82"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.45)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />
    </>
  );
}
