/**
 * Retired Learning Map / workspace / shop / support surfaces.
 * Known inbound URLs and unmatched public paths share one contact screen.
 */

export const RETIRED_PRODUCT_EMAIL = "daniel@uncertain.systems" as const;

export const RETIRED_PRODUCT_HEADING =
  "If you are looking for something that is not here anymore" as const;

export const RETIRED_PRODUCT_BODY =
  "If you are coming from a course, or looking for a learning map or a workspace that is no longer here, please contact daniel@uncertain.systems." as const;

export const RETIRED_PRODUCT_MAILTO = `mailto:${RETIRED_PRODUCT_EMAIL}` as const;

/** Public paths that used to ship maps, workspaces, AYCL shop, support, or brain priming. */
export const RETIRED_PRODUCT_PATHS = [
  "/workspace",
  "/workspaces",
  "/all-you-can-learn",
  "/support",
  "/docs/learning-map-api",
  "/p",
  "/brain-priming",
] as const;
