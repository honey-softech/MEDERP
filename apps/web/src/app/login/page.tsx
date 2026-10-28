import { Suspense } from "react";
import { PulseScreen } from "@/components/pulse-loader";
import { isMobileAppRequest } from "@/lib/mobile-app";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const isMobileApp = await isMobileAppRequest();
  return (
    <Suspense fallback={<PulseScreen />}>
      <LoginForm isMobileApp={isMobileApp} />
    </Suspense>
  );
}
