import { NextResponse } from "next/server";
import {
  findReferrerByCode,
  MAX_REFERRALS_PER_HOSPITAL,
  openReferralCount,
} from "@/lib/hospital-referrals";

export async function GET(request: Request) {
  const code = String(new URL(request.url).searchParams.get("code") ?? "").trim();
  if (code.length < 3) {
    return NextResponse.json({ valid: false, hospitalName: null });
  }

  const hospital = await findReferrerByCode(code);
  if (!hospital) {
    return NextResponse.json({ valid: false, hospitalName: null, message: "Referral code not recognised." });
  }

  const open = await openReferralCount(hospital.id);
  if (open >= MAX_REFERRALS_PER_HOSPITAL) {
    return NextResponse.json({
      valid: false,
      hospitalName: null,
      message: "That clinic has already reached the referral limit.",
    });
  }

  return NextResponse.json({ valid: true, hospitalName: hospital.name });
}
