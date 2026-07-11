import type { Metadata } from "next";
import { ProofOfWorkApiDemo } from "@/components/ProofOfWorkApiDemo";

export const metadata: Metadata = {
  title: "Demo",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <ProofOfWorkApiDemo />;
}