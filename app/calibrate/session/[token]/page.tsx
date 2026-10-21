import PrivateTapSessionPage from "@/components/guest-session/private-tap-session-page";

export default function CalibrateGuestSessionPage(props: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PrivateTapSessionPage {...props} flow="calibrate" />;
}
