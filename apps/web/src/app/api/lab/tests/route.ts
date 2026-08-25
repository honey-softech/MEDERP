import { NextResponse } from "next/server";
import { requireHospitalActor } from "@/lib/front-desk";
import { offeredTestsForHospital } from "@/lib/lab";

export async function GET() {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const tests = await offeredTestsForHospital(scoped.user.hospitalId);
  return NextResponse.json({ tests });
}
