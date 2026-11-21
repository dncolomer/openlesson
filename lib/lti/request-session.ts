import { cookies } from "next/headers";
import { decodeLaunchCookie } from "@/lib/lti/cookie";
import { LTI_LAUNCH_COOKIE, type LtiLaunchSession } from "@/lib/lti/session";

export async function readLtiLaunchSession(): Promise<LtiLaunchSession | null> {
  const jar = await cookies();
  return decodeLaunchCookie(jar.get(LTI_LAUNCH_COOKIE)?.value || "");
}

export function isInstructorLaunch(session: LtiLaunchSession | null): boolean {
  return Boolean(session?.instructor);
}
