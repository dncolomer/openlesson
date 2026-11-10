import { AYCL_HACKATHONS } from "@/lib/aycl-landing";
import { ACADEMY_K_HREF } from "@/lib/marketing/paths";
import type { ThesisDeepLink } from "@/lib/science/hub";

export const PROJECTS_PATHS = {
  events: "/community-events",
  kardashev: "/kardashev",
  academyK: ACADEMY_K_HREF,
} as const;

export const PROJECTS_DIRECTORY: readonly ThesisDeepLink[] = [
  { href: PROJECTS_PATHS.events, label: "Community Events", hint: "Hackathons and gatherings" },
  { href: PROJECTS_PATHS.kardashev, label: "Kardashev Research", hint: "Coming soon" },
  { href: PROJECTS_PATHS.academyK, label: "Academy-k", hint: "Course authoring" },
];

export const COMMUNITY_EVENTS_COPY = {
  eyebrow: "Projects & Community",
  title: "Community Events",
  lead:
    "In-person and online events where curious people learn frontier knowledge by doing — lectures, mentors, teams, and demos on ideas that are still taking shape.",
  directoryEyebrow: "ON THIS PAGE",
  directoryTitle: "Past and upcoming.",
  directoryLead: "Open an event from the list.",
} as const;

export const COMMUNITY_EVENTS_DIRECTORY: readonly ThesisDeepLink[] = [
  ...AYCL_HACKATHONS.map((event) => ({
    href: event.href,
    label: event.title,
    hint: event.status,
  })),
];

export const PROBABILISTIC_COMPUTING_DIRECTORY: readonly ThesisDeepLink[] = [
  { href: "#about", label: "About the event", hint: "Topics and audience" },
  { href: "#agenda", label: "Agenda", hint: "Started at 12:30" },
  { href: "#winners", label: "Winning projects", hint: "Prize pool" },
  { href: "#lifetime", label: "Lifetime access", hint: "Study the winners" },
  { href: PROJECTS_PATHS.events, label: "All community events", hint: "Back to the listing" },
];
