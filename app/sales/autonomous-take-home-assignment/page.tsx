import { redirect } from "next/navigation";

/** Legacy path — product renamed to Self-service Take-Home Assignment. */
export default function AutonomousTakeHomeAssignmentRedirect() {
  redirect("/sales/self-service-take-home-assignment");
}
