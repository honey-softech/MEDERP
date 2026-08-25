import { NextResponse } from "next/server";
import { getPlatformBillingSettings } from "@/lib/platform-billing";
import { razorpayConfigured } from "@/lib/razorpay";
import { publicSubscriptionTiers } from "@/lib/subscription-tiers";

export async function GET() {
  const settings = await getPlatformBillingSettings();
  return NextResponse.json({
    package: {
      companyName: settings.companyName,
      companyAddress: settings.companyAddress,
      companyPhone: settings.companyPhone,
      companyEmail: settings.companyEmail,
      gstin: settings.gstin,
      bankDetails: settings.bankDetails,
      termsNote: settings.termsNote,
      razorpayEnabled: razorpayConfigured(),
      tiers: publicSubscriptionTiers(),
    },
  });
}
