import { VerificationFlowRunner } from "@/components/VerificationFlowRunner";
import { parseProtocolLaunchIdentity } from "@/lib/verification-flow";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VerificationFlowPublicPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const prepopulatedIdentity = parseProtocolLaunchIdentity(query);
  return (
    <VerificationFlowRunner token={token} prepopulatedIdentity={prepopulatedIdentity} />
  );
}
