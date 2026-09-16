/**
 * Learning Experience Authoring pricing: contact-only, no public checkout.
 */
import { ENTERPRISE_SETUP_EMAIL, ENTERPRISE_SETUP_MAILTO } from "@/lib/marketing/paths";

export const AUTHORING_PACKAGE_STARTING_PRICE = "$15,000" as const;
export const AUTHORING_PACKAGE_HOURS = "40h" as const;

export const AUTHORING_PRICING_COPY = {
  eyebrow: "LEARNING EXPERIENCE AUTHORING",
  title: "Learning Experience Authoring",
  lead: "Starts at $15,000 for a 40h course package, including lifetime workspace access for students.",
  package: {
    eyebrow: "40H PACKAGE",
    name: "40h course package",
    price: "Starting at $15,000",
    priceAmount: AUTHORING_PACKAGE_STARTING_PRICE,
    body: "Includes lifetime workspace access for students. Contact for more details and custom packages.",
  },
  contactEmail: ENTERPRISE_SETUP_EMAIL,
  contactMailto: ENTERPRISE_SETUP_MAILTO,
  contactTitle: "Details and custom packages",
  contactBody:
    "Contact daniel@uncertain.systems for more details and custom packages.",
  contactCta: `Contact ${ENTERPRISE_SETUP_EMAIL}`,
} as const;
