"use client";

import { MarkerRadarChart } from "@/components/MarkerRadarChart";
import { BRAND_NAME } from "@/lib/brand";
import {
  SNAPSHOT_LANDING_SECTIONS,
  type SnapshotLandingSectionId,
  type SnapshotLandingView as SnapshotLandingViewModel,
} from "@/lib/pow-api/snapshot-share";
import { LWM_CLIENT_LABELS } from "@/lib/pow-api/lwm-snapshot-interpretability";

const LANDING_SECTION_TITLES: Record<SnapshotLandingSectionId, string> = {
  profile: "Profile",
  goals: "Goals",
  summary: "Summary",
  markers: "Markers",
  strengths: "Strengths",
  gaps: "Gaps",
  next_steps: "Next steps",
  details: "Details",
};

function formatRanAt(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return iso;
  }
}

export function SnapshotLandingView({
  view,
}: {
  view: SnapshotLandingViewModel;
}) {
  const ranLabel = formatRanAt(view.ran_at);
  const gapItems = view.gaps.items;
  const dirs = view.next_steps.directions;
  const events = view.next_steps.events;

  return (
    <main
      className="min-h-screen bg-[#0a0a0a] text-neutral-100"
      data-snapshot-landing
      data-snapshot-id={view.snapshot_id}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
          {BRAND_NAME} · Public snapshot
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Learning snapshot
        </h1>
        {ranLabel ? (
          <p className="mt-1 text-sm text-neutral-500">{ranLabel}</p>
        ) : null}

        <div
          className="mt-6 flex flex-wrap gap-3"
          data-snapshot-landing-scores
        >
          <div
            className="min-w-[6.5rem] rounded-none border border-white bg-white px-4 py-3 text-black"
            data-snapshot-skill-score
          >
            <p className="text-[10px] font-medium text-neutral-600">
              {view.skill_label || LWM_CLIENT_LABELS.primary_score_short}
            </p>
            <p className="font-mono text-3xl font-semibold tabular-nums leading-none">
              {view.skill_score}
            </p>
          </div>
          <div
            className="min-w-[6.5rem] rounded-none border border-white/70 bg-neutral-100 px-4 py-3 text-black"
            data-snapshot-authenticity-score
          >
            <p className="text-[10px] font-medium text-neutral-600">
              {view.authenticity_label || LWM_CLIENT_LABELS.ghc_score_short}
            </p>
            <p className="font-mono text-3xl font-semibold tabular-nums leading-none">
              {view.authenticity_score != null ? view.authenticity_score : "—"}
            </p>
          </div>
        </div>

        <div className="mt-10 space-y-8">
          {SNAPSHOT_LANDING_SECTIONS.map((section) => (
            <section
              key={section.id}
              id={`snapshot-${section.id}`}
              className="border-t border-neutral-800 pt-5"
              data-snapshot-landing-section={section.id}
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
                {LANDING_SECTION_TITLES[section.id]}
              </h2>

              {section.id === "profile" ? (
                <div className="mt-3" data-snapshot-landing-profile>
                  {view.profile.markers.length > 0 ? (
                    <div className="flex justify-center">
                      <MarkerRadarChart
                        markers={view.profile.markers}
                        variant="large"
                        ariaLabel="Competency marker scores"
                        className="aspect-square h-auto w-full max-w-[min(100%,24rem)]"
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-neutral-500">
                      No spider markers on this snapshot.
                    </p>
                  )}
                </div>
              ) : null}

              {section.id === "goals" ? (
                <div className="mt-3 space-y-2" data-snapshot-landing-goals>
                  {view.goals.evaluated_goals.length > 0 ? (
                    <ul className="space-y-2">
                      {view.goals.evaluated_goals.map((g, i) => (
                        <li
                          key={g.id || `${g.scope}-${i}`}
                          className="rounded-none border border-neutral-800 bg-neutral-950/60 px-3 py-2"
                        >
                          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                            {g.scope}
                          </p>
                          <p className="mt-0.5 text-sm leading-relaxed text-neutral-200">
                            {g.text}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : view.goals.workspace_goal ? (
                    <p className="text-sm leading-relaxed text-neutral-200">
                      {view.goals.workspace_goal}
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-500">
                      No goals recorded on this snapshot.
                    </p>
                  )}
                </div>
              ) : null}

              {section.id === "summary" ? (
                <div className="mt-3 space-y-3" data-snapshot-landing-summary>
                  {view.summary.text ? (
                    <p className="text-sm leading-relaxed text-neutral-300">
                      {view.summary.text}
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-500">
                      No summary on this snapshot.
                    </p>
                  )}
                  {view.summary.growth_areas.length > 0 ? (
                    <div>
                      <p className="text-[11px] font-medium text-neutral-400">
                        Growth areas
                      </p>
                      <ul className="mt-1 space-y-1 text-sm text-neutral-400">
                        {view.summary.growth_areas.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {view.summary.suggestions.length > 0 ? (
                    <div>
                      <p className="text-[11px] font-medium text-neutral-400">
                        Suggestions
                      </p>
                      <ul className="mt-1 space-y-1 text-sm text-neutral-400">
                        {view.summary.suggestions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {section.id === "markers" ? (
                <div className="mt-3" data-snapshot-landing-markers>
                  {view.markers.length > 0 ? (
                    <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                      {view.markers.map((marker) => (
                        <div
                          key={marker.id}
                          className="border-b border-neutral-800/60 pb-4"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-medium text-neutral-200">
                              {marker.label}
                            </span>
                            <span className="font-mono text-lg text-white">
                              {marker.score}
                            </span>
                          </div>
                          {marker.rationale ? (
                            <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                              {marker.rationale}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">
                      No markers on this snapshot.
                    </p>
                  )}
                </div>
              ) : null}

              {section.id === "strengths" ? (
                <div className="mt-3" data-snapshot-landing-strengths>
                  {view.strengths.length > 0 ? (
                    <ul className="space-y-2 text-sm leading-relaxed text-neutral-300">
                      {view.strengths.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-neutral-500">+</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-neutral-500">No strengths listed.</p>
                  )}
                </div>
              ) : null}

              {section.id === "gaps" ? (
                <div className="mt-3" data-snapshot-landing-gaps>
                  {gapItems.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      {view.gaps.summary || "No gaps identified."}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {view.gaps.summary ? (
                        <p className="text-sm leading-relaxed text-neutral-400">
                          {view.gaps.summary}
                        </p>
                      ) : null}
                      <ul className="space-y-2">
                        {gapItems.map((gap) => (
                          <li
                            key={gap.title}
                            className="rounded-none border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-sm"
                          >
                            <div className="font-medium text-neutral-200">
                              {gap.title}
                            </div>
                            {gap.proof_of_work ? (
                              <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                                {gap.proof_of_work}
                              </p>
                            ) : null}
                            {gap.suggested_repair ? (
                              <p className="mt-1 text-xs text-neutral-500">
                                Repair: {gap.suggested_repair}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}

              {section.id === "next_steps" ? (
                <div className="mt-3" data-snapshot-landing-next-steps>
                  {dirs.length === 0 && events.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      No next steps on this snapshot.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {dirs.length > 0 ? (
                        <div>
                          <p className="text-[11px] font-medium text-neutral-400">
                            Directions
                          </p>
                          <ul className="mt-1.5 space-y-1.5 text-sm text-neutral-300">
                            {dirs.map((d) => (
                              <li key={d} className="flex gap-2">
                                <span className="text-neutral-600">→</span>
                                <span>{d}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {events.length > 0 ? (
                        <div>
                          <p className="text-[11px] font-medium text-neutral-400">
                            Events
                          </p>
                          <ul className="mt-1.5 space-y-1.5 text-sm text-neutral-300">
                            {events.map((e) => (
                              <li key={e} className="flex gap-2">
                                <span className="text-neutral-600">•</span>
                                <span>{e}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}

              {section.id === "details" ? (
                <div
                  className="mt-3 space-y-1 text-sm text-neutral-400"
                  data-snapshot-landing-details
                >
                  {view.details.source ||
                  view.details.ran_at ||
                  view.details.confidence ||
                  view.details.ghc_confidence ||
                  view.details.temporal_summary ? (
                    <>
                      {view.details.source ? (
                        <p>Source: {view.details.source}</p>
                      ) : null}
                      {ranLabel ? <p>Ran at: {ranLabel}</p> : null}
                      {view.details.confidence ? (
                        <p>Confidence: {view.details.confidence}</p>
                      ) : null}
                      {view.details.ghc_confidence ? (
                        <p>
                          Authenticity confidence: {view.details.ghc_confidence}
                        </p>
                      ) : null}
                      {view.details.temporal_summary ? (
                        <p>{view.details.temporal_summary}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-neutral-500">No extra evidence metadata.</p>
                  )}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

export function SnapshotLandingMissing() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6 text-neutral-400"
      data-snapshot-landing
      data-snapshot-landing-missing
    >
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-white">Snapshot not found</h1>
        <p className="mt-2 text-sm leading-relaxed">
          This public link is invalid or was never published.
        </p>
      </div>
    </main>
  );
}
