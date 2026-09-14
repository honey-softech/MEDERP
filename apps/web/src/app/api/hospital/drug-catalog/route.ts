import { NextResponse } from "next/server";

/** Hospital admins cannot import the shared medicine catalog. Use /api/platform/drug-catalog. */
export async function GET() {
  return NextResponse.json(
    { error: "Only software admin or helpdesk can manage the medicine catalog." },
    { status: 403 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Only software admin or helpdesk can import the medicine catalog." },
    { status: 403 },
  );
}
