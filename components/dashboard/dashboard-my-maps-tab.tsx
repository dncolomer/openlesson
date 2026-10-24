"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkspaceCardHero } from "@/components/WorkspaceCardHero";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import type { Workspace } from "@/lib/storage";
import {
  DASHBOARD_MAPS_REMOVE_PATH,
  REMOVE_FROM_MY_MAPS_LABEL,
  playCopyWorkspaceHref,
} from "@/lib/workspace-play-copy";

export function DashboardMyMapsTab({
  maps,
  formatDate,
  coverImagePool = null,
}: {
  maps: Workspace[];
  formatDate: (dateStr: string) => string;
  coverImagePool?: readonly string[] | null;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const playMaps = useMemo(
    () => maps.filter((map) => !removedIds.includes(map.id)),
    [maps, removedIds],
  );

  async function removeMap(map: Workspace) {
    if (busyId) return;
    setBusyId(map.id);
    setError("");
    try {
      const res = await fetch("/api/dashboard/maps/remove" satisfies typeof DASHBOARD_MAPS_REMOVE_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: String(map.original_workspace_id || map.id).trim(),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(errorMessageFromBody(payload, "Could not remove map"));
      }
      setRemovedIds((ids) => (ids.includes(map.id) ? ids : [...ids, map.id]));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove map");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8" data-dashboard-my-maps>
      <section className="console-copy px-6 py-7 sm:px-8 sm:py-8">
        <h2 className="max-w-2xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
          My Maps
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
          Play copies you added from Home or bought as All You Can Learn. Maps you author live on
          Build.
        </p>
      </section>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <section className="space-y-3" data-dashboard-my-maps-play>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
          Play copies
        </p>
        {playMaps.length === 0 ? (
          <div className="console-copy px-6 py-8 sm:px-8">
            <p className="text-sm text-neutral-400">
              No play copies yet. Browse Home and add a public map, or buy an All You Can Learn map.
            </p>
            <Link
              href="/dashboard?tab=home"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-none border border-white/40 px-5 text-sm text-white hover:border-white/80"
            >
              Browse maps
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {playMaps.map((map) => (
              <MyMapsCard
                key={map.id}
                map={map}
                href={playCopyWorkspaceHref(map.id)}
                imagePool={coverImagePool}
                meta={`${map.aycl_category || "Map"}${
                  map.created_at ? ` · ${formatDate(map.created_at)}` : ""
                }`}
                action={
                  <button
                    type="button"
                    data-dashboard-remove-from-my-maps=""
                    aria-label={REMOVE_FROM_MY_MAPS_LABEL}
                    disabled={Boolean(busyId)}
                    onClick={() => void removeMap(map)}
                    className="absolute right-2 top-2 z-10 rounded-none border border-white/40 bg-black/80 px-2 py-1 text-[11px] font-medium text-white hover:border-white/80 disabled:opacity-40"
                  >
                    {busyId === map.id ? "Removing…" : "Remove"}
                  </button>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MyMapsCard({
  map,
  href,
  imagePool,
  meta,
  action = null,
}: {
  map: Workspace;
  href: string;
  imagePool: readonly string[] | null;
  meta: string;
  action?: ReactNode;
}) {
  return (
    <article
      data-dashboard-my-maps-card=""
      className="group relative min-h-[16rem] overflow-hidden rounded-none border border-white/20 text-left transition hover:border-white/60"
    >
      <Link href={href} className="absolute inset-0">
        <WorkspaceCardHero
          workspaceId={map.id}
          coverImageUrl={map.cover_image_url}
          imagePool={imagePool}
          fallback="aesthetic"
          heightClassName="absolute inset-0 h-full min-h-[16rem]"
        />
        <div className="relative flex min-h-[16rem] flex-col justify-end p-3 sm:p-4">
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300">
            {meta}
          </p>
          <p className="mt-1 text-sm font-medium text-white">{map.title || map.root_topic}</p>
        </div>
      </Link>
      {action}
    </article>
  );
}
