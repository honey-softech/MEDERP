import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { NURSE_VITALS_ROLES, canNurseRecordVitals, forbidUnless, patientName, requireHospitalActor, tokenLabel } from "@/lib/front-desk";
import { notifyDoctorVitalsReady } from "@/lib/notifications";
import { bmiLabel, calculateBmi, parseOptionalNumber, parseRequiredNumber } from "@/lib/vitals";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, NURSE_VITALS_ROLES);
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const appointment = await prisma.appointment.findFirst({
      where: { id, hospitalId: scoped.user.hospitalId },
      include: {
        patient: true,
        doctor: { include: { appUser: { select: { id: true, username: true } } } },
        vitals: true,
      },
    });
    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }
    if (["CANCELLED", "NO_SHOW"].includes(appointment.status)) {
      return NextResponse.json({ error: "Vitals cannot be recorded for this visit." }, { status: 409 });
    }
    if (!canNurseRecordVitals(appointment)) {
      return NextResponse.json(
        { error: "Vitals can only be recorded for today's visits. Previous visit records are locked." },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => null);
    const height = parseRequiredNumber(body?.heightCm, "Height (cm)", 40, 250);
    if ("error" in height) return NextResponse.json({ error: height.error }, { status: 400 });
    const weight = parseRequiredNumber(body?.weightKg, "Weight (kg)", 2, 400);
    if ("error" in weight) return NextResponse.json({ error: weight.error }, { status: 400 });
    const temperature = parseRequiredNumber(body?.temperatureC, "Temperature (°C)", 30, 45);
    if ("error" in temperature) return NextResponse.json({ error: temperature.error }, { status: 400 });
    const spo2 = parseOptionalNumber(body?.spo2Percent, "SpO2 (%)", 50, 100);
    if ("error" in spo2) return NextResponse.json({ error: spo2.error }, { status: 400 });
    const pulse = parseOptionalNumber(body?.pulseBpm, "Pulse (bpm)", 30, 220);
    if ("error" in pulse) return NextResponse.json({ error: pulse.error }, { status: 400 });
    const respiratory = parseOptionalNumber(body?.respiratoryRate, "Respiratory rate", 6, 60);
    if ("error" in respiratory) return NextResponse.json({ error: respiratory.error }, { status: 400 });
    const systolic = parseOptionalNumber(body?.bpSystolic, "BP systolic", 60, 260);
    if ("error" in systolic) return NextResponse.json({ error: systolic.error }, { status: 400 });
    const diastolic = parseOptionalNumber(body?.bpDiastolic, "BP diastolic", 30, 160);
    if ("error" in diastolic) return NextResponse.json({ error: diastolic.error }, { status: 400 });

    const bmi = calculateBmi(height.value, weight.value);
    if (bmi == null) {
      return NextResponse.json({ error: "Could not calculate BMI. Check height and weight." }, { status: 400 });
    }

    const hasFever = body?.hasFever === undefined ? temperature.value >= 38 : Boolean(body.hasFever);
    const sugarRaw = String(body?.bloodSugarMgDl ?? "").trim();
    const bloodSugarMgDl = sugarRaw ? Number(sugarRaw) : null;
    if (bloodSugarMgDl != null && (!Number.isFinite(bloodSugarMgDl) || bloodSugarMgDl < 20 || bloodSugarMgDl > 800)) {
      return NextResponse.json({ error: "Blood sugar must be between 20 and 800 mg/dL." }, { status: 400 });
    }
    const notes = String(body?.notes ?? "").trim() || null;

    const data = {
      hospitalId: scoped.user.hospitalId,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      recordedByUserId: scoped.user.id,
      recordedByUsername: scoped.user.username,
      heightCm: height.value,
      weightKg: weight.value,
      bmi,
      temperatureC: temperature.value,
      hasFever,
      spo2Percent: spo2.value == null ? null : Math.round(spo2.value),
      pulseBpm: pulse.value == null ? null : Math.round(pulse.value),
      respiratoryRate: respiratory.value == null ? null : Math.round(respiratory.value),
      bpSystolic: systolic.value == null ? null : Math.round(systolic.value),
      bpDiastolic: diastolic.value == null ? null : Math.round(diastolic.value),
      bloodSugarMgDl,
      notes,
    };

    const vitals = appointment.vitals
      ? await prisma.visitVitals.update({ where: { id: appointment.vitals.id }, data })
      : await prisma.visitVitals.create({ data });

    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: appointment.vitals ? "VITALS_UPDATED" : "VITALS_RECORDED",
      entity: "VisitVitals",
      entityId: vitals.id,
      summary: `${scoped.user.username} recorded vitals for ${patientName(appointment.patient)} (BMI ${bmi}, ${bmiLabel(bmi)}).`,
      metadata: {
        changes: diffAuditFields(
          appointment.vitals as unknown as Record<string, unknown> | undefined,
          vitals as unknown as Record<string, unknown>,
          {
            fields: [
              "heightCm",
              "weightKg",
              "bmi",
              "temperatureC",
              "hasFever",
              "spo2Percent",
              "pulseBpm",
              "respiratoryRate",
              "bpSystolic",
              "bpDiastolic",
              "bloodSugarMgDl",
              "notes",
            ],
          },
        ),
      },
    });

    if (!appointment.vitals) {
      await notifyDoctorVitalsReady({
        hospitalId: scoped.user.hospitalId,
        doctorAppUserId: appointment.doctor.appUserId,
        appointmentId: appointment.id,
        patientName: patientName(appointment.patient),
        token: tokenLabel(appointment.tokenNumber),
      });
    }

    return NextResponse.json({ ok: true, vitals, bmiLabel: bmiLabel(bmi) });
  } catch (error) {
    console.error("Failed to save vitals", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save vitals." },
      { status: 500 },
    );
  }
}
