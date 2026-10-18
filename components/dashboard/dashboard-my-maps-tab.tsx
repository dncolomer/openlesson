"use client";

import Link from "next/link";
import { WorkspaceCardHero } from "@/components/WorkspaceCardHero";
import type { Workspace } from "@/lib/storage";
import { playCopyWorkspaceHref } from "@/lib/workspace-play-copy";

export function DashboardMyMapsTab({
  maps,
  formatDate,
  coverImagePool = null,
}: {
  maps: Workspace[];
  formatDate: (dateStr: string) => string;
  coverImagePool?: readonly string[] | null;
}) {
  return (
    <div className="space-y-6" data-dashboard-my-maps>
      <section className="console-copy px-6 py-7 sm:px-8 sm:py-8">
        <h2 className="max-w-2xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
          Maps you play.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
          Permanent play copies from Home. Open a map, pick a block, and start a session.
        </p>
      </section>

      {maps.length === 0 ? (
        <section className="console-copy px-6 py-10 sm:px-8">
          <p className="text-sm text-neutral-400">
            No maps yet. Browse Home and add a public map, or buy an All You Can Learn map.
          </p>
          <Link
            href="/dashboard?tab=home"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-none border border-white/40 px-5 text-sm text-white hover:border-white/80"
          >
            Browse maps
          </Link>
        </section>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {maps.map((map) => (
            <Link
              key={map.id}
              href={playCopyWorkspaceHref(map.id)}
              data-dashboard-my-maps-card
              className="group relative min-h-[16rem] overflow-hidden rounded-none border border-white/20 text-left transition hover:border-white/60"
            >
              <WorkspaceCardHero
                workspaceId={map.id}
                coverImageUrl={map.cover_image_url}
                imagePool={coverImagePool}
                fallback="aesthetic"
                heightClassName="absolute inset-0 h-full min-h-[16rem]"
              />
              <div className="relative flex min-h-[16rem] flex-col justify-end p-3 sm:p-4">
                <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300">
                  {map.aycl_category || "Map"}
                  {map.created_at ? ` · ${formatDate(map.created_at)}` : ""}
                </p>
                <p className="mt-1 text-sm font-medium text-white">{map.title || map.root_topic}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
