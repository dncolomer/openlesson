import { redirect } from "next/navigation";

/** Legacy path — product renamed to Self-Service Take-Home. */
export default function SelfServiceTakeHomeAssignmentRedirect() {
  redirect("/sales/self-service-take-home");
}
