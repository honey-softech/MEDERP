import { isMobileAppRequest } from "@/lib/mobile-app";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const isMobileApp = await isMobileAppRequest();
  return <SignupForm isMobileApp={isMobileApp} />;
}
