import { redirect } from "next/navigation";
import { BRAIN_PRIMING_PATH } from "@/lib/marketing/paths";

export default function BrainPrimingJoinRedirect() {
  redirect(`${BRAIN_PRIMING_PATH}#join`);
}
