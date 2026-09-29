import { getCurrentUser } from "@/lib/auth";
import { MarketingLanding } from "@/components/marketing-landing";
import { HomeDashboard } from "./home-dashboard";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <MarketingLanding />;
  return <HomeDashboard searchParams={searchParams} />;
}
