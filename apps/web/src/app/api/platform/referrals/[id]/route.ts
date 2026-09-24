import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { approveReferral, ReferralReviewError, rejectReferral } from "@/lib/hospital-referrals";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SOFTWARE_ADMIN") {
    return NextResponse.json({ error: "Software admin access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { action?: string; reviewNote?: string } | null;
  const action = String(body?.action ?? "");
  const note = body?.reviewNote != null ? String(body.reviewNote) : null;

  try {
    if (action === "approve") {
      const result = await approveReferral({
        referralId: id,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        note,
        request,
      });
      return NextResponse.json({
        ok: true,
        rewardMonths: result.rewardMonths,
        trialEndsAt: result.trialEndsAt?.toISOString() ?? null,
      });
    }
    if (action === "reject") {
      await rejectReferral({
        referralId: id,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        note,
        request,
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  } catch (error) {
    if (error instanceof ReferralReviewError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Referral review failed", error);
    return NextResponse.json({ error: "Could not update this referral." }, { status: 500 });
  }
}
