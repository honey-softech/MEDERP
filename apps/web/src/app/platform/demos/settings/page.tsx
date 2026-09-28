import { AppShell } from "@/components/app-shell";
import { DemoSettingsForm } from "./settings-form";

export default async function DemoSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const notice =
    params.connected === "1"
      ? "Google Calendar connected."
      : params.error === "google-config"
        ? "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server. Callback always uses https://mederp.co.in."
        : params.error === "oauth"
          ? "Google Calendar connection failed. Try again."
          : undefined;

  return (
    <AppShell title="Demo calendar">
      <p className="mb-6 text-sm text-slate-500">
        Connect the sales calendar, then set hours and how long each demo lasts. Public booking is at /demo.
      </p>
      <DemoSettingsForm notice={notice} />
    </AppShell>
  );
}
