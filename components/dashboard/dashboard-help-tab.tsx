"use client";

export function DashboardHelpTab() {
  return (
    <section className="console-copy px-6 py-14 sm:px-10 sm:py-16" data-dashboard-help>
      <p className="mb-4 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
        Support
      </p>
      <h2 className="text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
        How it works
      </h2>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-400 sm:text-base">
        Walkthroughs for Learning, Verification, and Calibration are coming soon.
        Platform videos will live here.
      </p>
      <p
        className="mt-8 inline-flex border border-white/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-300"
        data-dashboard-help-coming-soon
      >
        Coming soon
      </p>
      <p className="mt-8 text-sm text-neutral-400">
        Contact:{" "}
        <a
          href="mailto:daniel@uncertain.systems"
          className="text-white underline decoration-white/30 underline-offset-2"
          data-dashboard-help-contact
        >
          daniel@uncertain.systems
        </a>
      </p>
    </section>
  );
}
