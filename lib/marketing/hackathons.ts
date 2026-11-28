/** Shared community-events catalog. */
export const AYCL_HACKATHONS = [
  {
    id: "pc-hackathon",
    title: "Probabilistic Computing Hackathon",
    kind: "Hackathon",
    host: "ETH Zurich",
    date: "June 10, 2026",
    location: "Zurich, Switzerland",
    status: "Past event" as const,
    description:
      "A hands-on day on probabilistic and thermodynamic computing — Energy-Based Models, THRML, lectures, team builds, and demos. Winners and lifetime packages coming soon.",
    href: "/community-events/probabilistic-computing",
    image:
      "https://cdn.sanity.io/images/otrk6k1t/production/7ef4d9c0fcf06719cb7ddd7ebdb20b02a2355793-1736x1284.webp?auto=format&fit=max&q=75&w=868",
  },
  {
    id: "ground-state",
    title: "Thermosynthesis",
    kind: "3 Day Event",
    host: "",
    date: "",
    location: "",
    status: "To be announced" as const,
    description: "To be Announced soon",
    href: "/community-events/ground-state",
    // In-repo copy of https://ground-state.grok.me/images/hero-chip.jpg
    image: "/hackathons/ground-state-hero.jpg",
  },
] as const;
