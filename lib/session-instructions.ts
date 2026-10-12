export const SESSION_GUIDES = ["learn", "calibrate", "verification"] as const;

export type SessionGuideId = (typeof SESSION_GUIDES)[number];

/**
 * Static task text for the sidebar Instructions tab.
 * Calibrate matches the session-goal slide. Learn matches the onboarding task.
 */
export const SESSION_INSTRUCTIONS: Record<SessionGuideId, string> = {
  learn:
    "Speak, write, and draw on the work canvas. That is your work.\n\nPress commit (insight), write what you learned, and submit it. A valid insight stays with this chapter.",
  calibrate:
    "Your goal is a baseline for this topic: which questions you can answer, and which you cannot.\n\nMove three questions into Comfortable answering and two into Not confident. Each area has a filled space. Write the answer to one question you know in Comfortable answering. Write why you could not answer one question in Not confident.\n\nNo speaking is required. When time ends, the score is your distance from the cheapest path on a map of this topic prepared before you started. Distance 0 means every step matched that path.",
  verification:
    "Work the question on the canvas before the clock ends.\n\nWhen time ends, the score is your distance from the cheapest path on a map of this topic prepared before you started. Distance 0 means every step matched that path. The score is stored with the identity you claimed.",
};
