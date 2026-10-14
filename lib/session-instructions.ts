export const SESSION_GUIDES = ["learn", "calibrate", "verification"] as const;

export type SessionGuideId = (typeof SESSION_GUIDES)[number];

/**
 * Static task text for the sidebar Instructions tab.
 * Calibrate matches the session-goal slide. Learn matches the onboarding task.
 */
export const SESSION_INSTRUCTIONS: Record<SessionGuideId, string> = {
  learn:
    "Speak, write, and draw on the work canvas. That is your work.\n\nPress Infer, write the hidden cause you found, and submit it. A valid posterior stays with this chapter.",
  calibrate:
    "Read the opening lines out loud to start. Then tap every hidden state you would not trust yourself to occupy. The screens get finer or stop on their own. No speaking is required after the opening.\n\nThis is a prior of where your uncertainty sits, for later Learn sessions.",
  verification:
    "Work the question on the canvas before the clock ends.\n\nWhen time ends, the score is your distance from the cheapest policy on the generative model prepared before you started. Distance 0 means every step matched that policy. The score is stored with the identity you claimed.",
};
