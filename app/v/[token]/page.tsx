import { VerificationFlowRunner } from "@/components/VerificationFlowRunner";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function VerificationFlowPublicPage({ params }: PageProps) {
  const { token } = await params;
  return <VerificationFlowRunner token={token} />;
}
