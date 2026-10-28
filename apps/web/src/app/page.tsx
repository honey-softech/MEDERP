import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { MarketingLanding } from "@/components/marketing-landing";
import { isMobileAppRequest } from "@/lib/mobile-app";
import { HomeDashboard } from "./home-dashboard";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    if (await isMobileAppRequest()) redirect("/login");
    return <MarketingLanding />;
  }
  return <HomeDashboard searchParams={searchParams} />;
}
