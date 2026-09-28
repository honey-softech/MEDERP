import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cancelDemoById, completeDemo, DemoError } from "@/lib/demo/bookings";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== "SOFTWARE_ADMIN") {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  try {
    if (action === "cancel") return NextResponse.json(await cancelDemoById(id));
    if (action === "complete") return NextResponse.json(await completeDemo(id));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    if (error instanceof DemoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
