import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SalesProductCardPage } from "@/components/SalesProductCardPage";
import { getSalesProductCard } from "@/lib/sales/product-cards";

const SLUG = "self-service-skill-check";
const card = getSalesProductCard(SLUG);

export const metadata: Metadata = {
  title: card ? `${card.title} | Sales` : "Sales product card",
  description: card?.oneLine,
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function SelfServiceSkillCheckSalesPage() {
  if (!card) notFound();
  return <SalesProductCardPage card={card} />;
}
