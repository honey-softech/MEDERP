import { NextResponse } from "next/server";
import { assertCanCloseHospital } from "@/lib/account-lifecycle";
import { sendActionOtp } from "@/lib/action-otp";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const allowed = await assertCanCloseHospital(user);
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  return sendActionOtp(request, user, "close-hospital", "close-hospital-otp");
}
