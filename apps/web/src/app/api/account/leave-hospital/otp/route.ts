import { NextResponse } from "next/server";
import { assertCanLeaveHospital } from "@/lib/account-lifecycle";
import { sendActionOtp } from "@/lib/action-otp";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const allowed = await assertCanLeaveHospital(user);
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  return sendActionOtp(request, user, "leave-hospital", "leave-hospital-otp");
}
