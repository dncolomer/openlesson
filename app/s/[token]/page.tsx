import { SolveFlowRunner } from "@/components/SolveFlowRunner";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SolveFlowPublicPage({ params }: PageProps) {
  const { token } = await params;
  return <SolveFlowRunner token={token} />;
}
