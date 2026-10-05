import { CalibrationFlowRunner } from "@/components/CalibrationFlowRunner";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function CalibrationFlowPublicPage({ params }: PageProps) {
  const { token } = await params;
  return <CalibrationFlowRunner token={token} />;
}
