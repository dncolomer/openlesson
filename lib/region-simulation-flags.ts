/**
 * Region simulation feature flags. Prod canvas-faithful requires jobs.
 */

export function regionSimulationJobsEnabled(): boolean {
  if (process.env.REGION_SIM_JOBS === "0") return false;
  if (process.env.REGION_SIM_JOBS === "1") return true;
  return process.env.NODE_ENV === "production";
}

export function regionSimulationCanvasFaithfulEnabled(): boolean {
  if (process.env.REGION_SIM_CANVAS_FAITHFUL === "0") return false;
  if (process.env.REGION_SIM_CANVAS_FAITHFUL === "1") {
    if (process.env.NODE_ENV === "production" && !regionSimulationJobsEnabled()) return false;
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

export function regionSimulationAiUseEnabled(): boolean {
  if (process.env.REGION_SIM_AI_USE === "0") return false;
  if (process.env.REGION_SIM_AI_USE === "1") {
    if (process.env.NODE_ENV === "production" && !regionSimulationJobsEnabled()) return false;
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

export function regionSimulationCronSecret(): string {
  return String(process.env.CRON_SECRET || process.env.REGION_SIM_TICK_SECRET || "").trim();
}
