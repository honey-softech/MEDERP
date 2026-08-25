import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function PlatformSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SOFTWARE_ADMIN") {
    if (user?.role === "SUPER_ADMIN") {
      redirect("/hospital/audit-log");
    }
    redirect("/login");
  }
  return children;
}
