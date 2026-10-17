import { redirect } from "next/navigation";

export default function VerificationPricingRedirect() {
  redirect("/pricing#verification");
}
