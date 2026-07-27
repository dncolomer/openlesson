import { redirect } from "next/navigation";

/** Legacy path — product renamed to Self-Service Skill Check. */
export default function EarlySelfServiceScreeningRedirect() {
  redirect("/sales/self-service-skill-check");
}
