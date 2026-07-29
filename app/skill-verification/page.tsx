import type { Metadata } from "next";
import { SkillVerificationLanding } from "./SkillVerificationLanding";

export const metadata: Metadata = {
  title: "Hard Skill Verification for Recruitment & HR | Uncertain Systems",
  description:
    "Self-Service Skill Check and Self-Service Take-Home for recruitment teams, startup HR, and recruitment service providers. Hard skill verification that scales, without AI-faked test results.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SkillVerificationPage() {
  return <SkillVerificationLanding />;
}
