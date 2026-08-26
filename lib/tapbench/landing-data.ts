/**
 * Server-side TAPBench landing payload. Empty catalog/results are honest.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { listTapbenchBenchmarkTasks, type TapbenchTask } from "./catalog";
import { publicTapbenchRunView, type TapbenchPublicRun } from "./runs";
import { supabaseTapbenchRunStore } from "./store-supabase";
import { listTapbenchPublicRegions, type TapbenchPublicRegion } from "./region";

export type { TapbenchPublicRun, TapbenchPublicRegion };

export async function loadTapbenchLandingData(): Promise<{
  tasks: TapbenchTask[];
  results: TapbenchPublicRun[];
  regions: TapbenchPublicRegion[];
}> {
  try {
    const supabase = createAdminClient();
    const tasks = await listTapbenchBenchmarkTasks(supabase);
    const [runs, regions] = await Promise.all([
      supabaseTapbenchRunStore(supabase).listAll(),
      listTapbenchPublicRegions(
        supabase,
        tasks.map((t) => t.id),
      ),
    ]);
    return {
      tasks,
      results: runs.map(publicTapbenchRunView),
      regions,
    };
  } catch {
    return { tasks: [], results: [], regions: [] };
  }
}
