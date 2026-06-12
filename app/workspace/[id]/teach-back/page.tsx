import { TeachBackClient } from "@/components/TeachBackClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeachBackPage({ params }: PageProps) {
  const { id } = await params;
  return <TeachBackClient planId={id} />;
}
