import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { getPublicProfile, profileDescription, profileDisplayName } from "@/lib/public-profile";
import { buildContributionDays, contributionLevel, contributionMonthLabels, groupContributionWeeks } from "@/lib/contributions";

interface PageProps {
  params: Promise<{ username: string }>;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plan";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);

  if (!profile) {
    return { title: "Profile Not Found - openLesson" };
  }

  const title = `${profileDisplayName(profile)}'s learning profile`;
  const description = profileDescription(profile);
  const image = `/u/${profile.username}/opengraph-image`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicUserProfilePage({ params }: PageProps) {
  const { username } = await params;
  const profile = await getPublicProfile(username);

  if (!profile) notFound();

  const displayName = profileDisplayName(profile);
  const learningMinutes = profile.stats.learning_minutes;
  const learningHours = learningMinutes === null ? null : Math.max(1, Math.round(learningMinutes / 60));
  const contributionDays = buildContributionDays(profile.contribution_days);
  const contributionWeeks = groupContributionWeeks(contributionDays);
  const contributionMonths = contributionMonthLabels(contributionWeeks);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-3xl border border-neutral-800 bg-neutral-950/80 p-6 shadow-2xl shadow-black/30">
            <div className="flex items-center gap-4 lg:block">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-neutral-700 bg-gradient-to-br from-emerald-400 via-sky-500 to-violet-500 text-4xl font-bold text-white shadow-lg shadow-sky-950/40 lg:h-32 lg:w-32">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="h-full w-full rounded-3xl object-cover" />
                ) : (
                  profile.username.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 lg:mt-5">
                <h1 className="truncate text-2xl font-semibold tracking-tight">{displayName}</h1>
                <p className="text-sm text-neutral-500">@{profile.username}</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-neutral-300">
              {profile.bio || "Building a public learning trail on openLesson."}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-neutral-800 bg-black/30 p-3">
                <div className="text-xl font-semibold">{profile.stats.public_plans}</div>
                <div className="text-[11px] uppercase tracking-wide text-neutral-500">Plans</div>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-black/30 p-3">
                <div className="text-xl font-semibold">{profile.stats.completed_sessions ?? "--"}</div>
                <div className="text-[11px] uppercase tracking-wide text-neutral-500">Sessions</div>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-black/30 p-3">
                <div className="text-xl font-semibold">{learningHours ?? "--"}</div>
                <div className="text-[11px] uppercase tracking-wide text-neutral-500">Hours</div>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-neutral-800 bg-black/30 p-4 text-xs text-neutral-500">
              Learning publicly since {formatDate(profile.created_at)}
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <section className="min-w-0 overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/70">
              <div className="border-b border-neutral-800 px-6 py-4">
                <h2 className="font-semibold">Learning Map</h2>
                <p className="mt-1 text-sm text-neutral-500">{learningMinutes ?? 0} public learning minutes in the last year.</p>
              </div>
              <div className="min-w-0 p-4 sm:p-6">
                <div className="max-w-full overflow-x-auto pb-2">
                  <div className="w-max min-w-full">
                    <div className="mb-2 ml-9 grid text-[11px] text-neutral-500" style={{ gridTemplateColumns: `repeat(${contributionWeeks.length}, 12px)`, columnGap: "3px" }}>
                      {contributionMonths.map((month) => <span key={month.index}>{month.label}</span>)}
                    </div>
                    <div className="flex gap-2">
                      <div className="grid grid-rows-7 gap-[3px] pt-[15px] text-[11px] text-neutral-500">
                        <span />
                        <span>Mon</span>
                        <span />
                        <span>Wed</span>
                        <span />
                        <span>Fri</span>
                        <span />
                      </div>
                      <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
                        {contributionWeeks.flatMap((week, weekIndex) =>
                          Array.from({ length: 7 }, (_, dayIndex) => {
                            const day = week[dayIndex] || null;
                            const level = contributionLevel(day?.minutes || 0);
                            return (
                              <div
                                key={`${weekIndex}-${dayIndex}`}
                                title={day ? `${day.minutes} minutes on ${formatDate(day.date)}` : ""}
                                className={[
                                  "h-3 w-3 rounded-[3px] border",
                                  level === 0 ? "border-neutral-800 bg-neutral-900" : "border-emerald-400/20",
                                  level === 1 ? "bg-emerald-950" : "",
                                  level === 2 ? "bg-emerald-800" : "",
                                  level === 3 ? "bg-emerald-500" : "",
                                  level === 4 ? "bg-emerald-300" : "",
                                ].join(" ")}
                              />
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-1 text-xs text-neutral-500">
                      <span>Less</span>
                      {[0, 1, 2, 3, 4].map((level) => (
                        <span key={level} className={["h-3 w-3 rounded-[3px] border", level === 0 ? "border-neutral-800 bg-neutral-900" : "border-emerald-400/20", level === 1 ? "bg-emerald-950" : "", level === 2 ? "bg-emerald-800" : "", level === 3 ? "bg-emerald-500" : "", level === 4 ? "bg-emerald-300" : ""].join(" ")} />
                      ))}
                      <span>More</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="min-w-0 rounded-3xl border border-neutral-800 bg-neutral-950/70 p-4 sm:p-6">
                <h2 className="font-semibold">Activity</h2>
                <div className="mt-5 space-y-4">
                  {profile.activity.length > 0 ? profile.activity.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="flex min-w-0 gap-3">
                      <div className="mt-1 h-3 w-3 shrink-0 rounded-full border border-emerald-400 bg-emerald-400/30" />
                      <div className="min-w-0">
                        <p className="break-words text-sm text-neutral-200">
                          {item.type === "plan_published" ? "Published" : "Completed"} <span className="text-white">{item.title}</span>
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">{formatDate(item.occurred_at)}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-neutral-500">No public activity yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-neutral-800 bg-neutral-950/70 p-6">
                <h2 className="font-semibold">Public Plans</h2>
                <div className="mt-5 space-y-3">
                  {profile.plans.slice(0, 5).map((plan) => (
                    <Link key={plan.id} href={`/p/${plan.id}/${slugify(plan.title)}`} className="block rounded-2xl border border-neutral-800 bg-black/30 p-4 transition-colors hover:border-neutral-600">
                      <div className="text-sm font-medium text-neutral-100">{plan.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-neutral-500">{plan.description || plan.root_topic}</div>
                      <div className="mt-3 text-xs text-neutral-600">{formatDate(plan.created_at)} · {plan.remix_count} remixes</div>
                    </Link>
                  ))}
                  {profile.plans.length === 0 && <p className="text-sm text-neutral-500">No public plans yet.</p>}
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
