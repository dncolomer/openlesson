/** HTML presenter of the live Unsys 5-minute pitch (`public/pitch.pdf` / `/pitch`). */

export const PITCH_WEB_PATH = "/pitch-web" as const;

export const PITCH_WEB_STAGE = {
  width: 1920,
  height: 1080,
} as const;

export type PitchWebSectionId =
  | "problem"
  | "autopilot"
  | "free-energy"
  | "engine"
  | "artifact"
  | "gtm"
  | "traction";

export type PitchWebSection = {
  id: PitchWebSectionId;
  nav: string;
  kicker: string;
  footer: string;
};

export const PITCH_WEB_SECTIONS: PitchWebSection[] = [
  {
    id: "problem",
    nav: "01 PROBLEM",
    kicker: "01 // THE PROBLEM",
    footer: "HARD SKILLS ARE SCARCE AND HARD TO VERIFY.",
  },
  {
    id: "autopilot",
    nav: "02 AUTOPILOT",
    kicker: "02 // AUTOPILOT",
    footer: "AI TUTORS ARE THE GPS. WE BUILD THE AUTOPILOT.",
  },
  {
    id: "free-energy",
    nav: "03 FREE ENERGY",
    kicker: "03 // UNDER THE HOOD",
    footer: "NOT CONTENT OR Q&A. A MAP THAT SHRINKS UNCERTAINTY.",
  },
  {
    id: "engine",
    nav: "04 THE ENGINE",
    kicker: "04 // KNOWLEDGE EMBEDDINGS",
    footer: "ONE EMBEDDING SPACE DRIVES THE LEARNING AND THE PROOF.",
  },
  {
    id: "artifact",
    nav: "05 THE ARTIFACT",
    kicker: "05 // THE ARTIFACT",
    footer: "YOUR SKILLS NEED, AS A LIVING MAP YOU OWN.",
  },
  {
    id: "gtm",
    nav: "06 GO-TO-MARKET",
    kicker: "06 // GO-TO-MARKET",
    footer: "COMMUNITIES FIRST. THEN PROGRAMS. THEN COMPANIES.",
  },
  {
    id: "traction",
    nav: "07 TRACTION",
    kicker: "07 // TRACTION",
    footer: "REPEAT BUYER: FROM 2 COURSES TO A FULL UNIT.",
  },
];

export function parsePitchWebHash(hash: string, total = PITCH_WEB_SECTIONS.length): number | null {
  const raw = hash.replace(/^#/, "").trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > total) return null;
  return n - 1;
}

export function pitchWebHash(index: number): string {
  return `#${index + 1}`;
}
