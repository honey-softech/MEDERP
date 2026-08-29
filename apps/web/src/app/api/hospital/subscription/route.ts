import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  cancelHospitalSubscription,
  monthlyAmountForHospital,
  scheduleNextCyclePackageChange,
} from "@/lib/hospital-subscription";
import { razorpayConfigured } from "@/lib/razorpay";
import { publicSubscriptionTiers } from "@/lib/subscription-tiers";

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SUPER_ADMIN" || !actor.hospitalId) {
    return NextResponse.json({ error: "Hospital super admin access required." }, { status: 403 });
  }

  const hospital = await prisma.hospital.findUnique({
    where: { id: actor.hospitalId },
    include: { subscription: true },
  });
  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found." }, { status: 404 });
  }

  const quote = await monthlyAmountForHospital(hospital);
  return NextResponse.json({
    hospital: {
      id: hospital.id,
      code: hospital.code,
      name: hospital.name,
      subscriptionTier: hospital.subscriptionTier,
      includedStaffSlots: hospital.includedStaffSlots,
      extraStaffSlots: hospital.extraStaffSlots,
      unlimitedStaffSeats: hospital.unlimitedStaffSeats,
      pharmacyEnabled: hospital.pharmacyEnabled,
      labEnabled: hospital.labEnabled,
      inventoryEnabled: hospital.inventoryEnabled,
    },
    subscription: hospital.subscription,
    currentMonthly: quote.total,
    tiers: publicSubscriptionTiers(),
    razorpayEnabled: razorpayConfigured(),
  });
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SUPER_ADMIN" || !actor.hospitalId) {
    return NextResponse.json({ error: "Hospital super admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "schedule");

  try {
    if (action === "cancel") {
      const before = await prisma.hospitalSubscription.findUnique({ where: { hospitalId: actor.hospitalId } });
      const subscription = await cancelHospitalSubscription({
        hospitalId: actor.hospitalId,
        atCycleEnd: body?.atCycleEnd !== false,
      });
      await writeAuditLog({
        request,
        hospitalId: actor.hospitalId,
        actorUserId: actor.id,
        actorUsername: actor.username,
        actorRole: actor.role,
        action: "SUBSCRIPTION_CANCEL_REQUESTED",
        entity: "HospitalSubscription",
        entityId: subscription.id,
        summary: `${actor.username} requested subscription cancellation (${subscription.cancelAtPeriodEnd ? "end of cycle" : "immediate"}).`,
        metadata: {
          changes: diffAuditFields(
            { status: before?.status, cancelAtPeriodEnd: before?.cancelAtPeriodEnd },
            { status: subscription.status, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd },
            { fields: ["status", "cancelAtPeriodEnd"] },
          ),
        },
      });
      return NextResponse.json({ ok: true, subscription });
    }

    const current = await prisma.hospital.findUnique({
      where: { id: actor.hospitalId },
      select: { subscriptionTier: true, subscription: { select: { pendingSubscriptionTier: true, pendingMonthlyAmount: true } } },
    });
    const result = await scheduleNextCyclePackageChange({
      hospitalId: actor.hospitalId,
      tierId: String(body?.tierId ?? ""),
      termsAccepted: Boolean(body?.termsAccepted),
    });

    await writeAuditLog({
      request,
      hospitalId: actor.hospitalId,
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: "SUBSCRIPTION_SCHEDULED_CHANGE",
      entity: "HospitalSubscription",
      entityId: result.subscription.id,
      summary: `${actor.username} scheduled next-cycle plan change to ₹${result.nextMonthly}/month.`,
      metadata: {
        nextMonthly: result.nextMonthly,
        pendingSubscriptionTier: result.pendingSubscriptionTier,
        changes: diffAuditFields(
          {
            pendingSubscriptionTier: current?.subscription?.pendingSubscriptionTier ?? current?.subscriptionTier,
            pendingMonthlyAmount: current?.subscription?.pendingMonthlyAmount ?? null,
          },
          {
            pendingSubscriptionTier: result.pendingSubscriptionTier,
            pendingMonthlyAmount: result.nextMonthly,
          },
          { fields: ["pendingSubscriptionTier", "pendingMonthlyAmount"] },
        ),
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update subscription." },
      { status: 400 },
    );
  }
}
