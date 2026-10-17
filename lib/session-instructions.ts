export const SESSION_GUIDES = ["learn", "calibrate", "verification"] as const;

export type SessionGuideId = (typeof SESSION_GUIDES)[number];

/**
 * Static task text for the sidebar Help tab.
 * Names what the learner sees on screen. Do not stitch titles or territories
 * into stock sentences.
 */
export const SESSION_INSTRUCTIONS: Record<SessionGuideId, string> = {
  learn:
    "Speak, write, and draw on the work canvas. That is your work.\n\nPress commit (insight), write the takeaway in your own words, and submit it for evaluation. A kept takeaway stays with this chapter.",
  calibrate:
    "Read the opening lines out loud to start. Then tap every question you would not trust yourself to answer. The screens get finer or stop on their own. No speaking is required after the opening.\n\nThis records which questions felt uncertain, for later Learn sessions.",
  verification:
    "Work the question on the canvas before the clock ends.\n\nEnd session, or wait for the clock, to see a Distance score. Distance 0 means every step matched. The score is stored.",
};

/** Start-screen intros. Short complete sentences. Do not stitch titles into them. */
export const SESSION_BRIEFING_INTRO: Record<SessionGuideId, string> = {
  learn: "Choose the look, then work on the canvas. Think out loud the whole time.",
  calibrate:
    "Read the opening lines out loud to start. Then tap every question you would not trust yourself to answer. No speaking is required after the opening.",
  verification:
    "Work the question on the canvas before the clock ends. End session, or wait for the clock, to see Distance.",
};
