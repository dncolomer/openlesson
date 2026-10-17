/**
 * Knowledge Mapping pricing: contact-only generic quote, no public checkout.
 */
import { ENTERPRISE_SETUP_EMAIL, ENTERPRISE_SETUP_MAILTO } from "@/lib/marketing/paths";

export const MAPPING_DATA_POINT_PRICE = "$1" as const;

export const MAPPING_PRICING_COPY = {
  eyebrow: "KNOWLEDGE MAPPING",
  title: "Knowledge Mapping",
  lead: "A generic quote of $1 per data point. Contact for more details and custom packages.",
  quote: {
    eyebrow: "DATA POINT",
    name: "Per data point",
    price: "$1 per data point",
    priceAmount: MAPPING_DATA_POINT_PRICE,
    body: "A generic quote for mapping knowledge as data points. Contact for more details and custom packages.",
  },
  contactEmail: ENTERPRISE_SETUP_EMAIL,
  contactMailto: ENTERPRISE_SETUP_MAILTO,
  contactTitle: "Details and custom packages",
  contactBody: "Contact daniel@uncertain.systems for more details and custom packages.",
  contactCta: `Contact ${ENTERPRISE_SETUP_EMAIL}`,
} as const;
