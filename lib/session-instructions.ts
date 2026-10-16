export const SESSION_GUIDES = ["learn", "calibrate", "verification"] as const;

export type SessionGuideId = (typeof SESSION_GUIDES)[number];

/**
 * Static task text for the sidebar Help tab.
 * Names what the learner sees on screen. Briefing, Harness, and live hints
 * keep the FEP terms.
 */
export const SESSION_INSTRUCTIONS: Record<SessionGuideId, string> = {
  learn:
    "Speak, write, and draw on the work canvas. That is your work.\n\nPress commit (insight), write the takeaway in your own words, and submit it for evaluation. A kept takeaway stays with this chapter.",
  calibrate:
    "Read the opening lines out loud to start. Then tap every question you would not trust yourself to answer. The screens get finer or stop on their own. No speaking is required after the opening.\n\nThis records which questions felt uncertain, for later Learn sessions.",
  verification:
    "Work the question on the canvas before the clock ends.\n\nWhen time ends, you see a Distance score. Distance 0 means every step matched. The score is stored with the name you claimed.",
};
