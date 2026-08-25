import { NextResponse } from "next/server";
import { allocateUniqueHospitalCode } from "@/lib/hospital-registration";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = String(searchParams.get("name") ?? "").trim();
  const requested = String(searchParams.get("code") ?? "").trim();
  if (name.length < 2) {
    return NextResponse.json({ code: "" });
  }
  const code = await allocateUniqueHospitalCode(name, requested || undefined);
  return NextResponse.json({ code });
}
