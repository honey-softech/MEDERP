import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  EXTERNAL_REPORT_UPLOAD_ROLES,
  LAB_REPORT_VIEW_ROLES,
  LAB_WORK_ROLES,
  patientName,
  requireHospitalActor,
} from "@/lib/front-desk";
import { notifyLabResults } from "@/lib/lab";
import {
  isAllowedLabReport,
  readLabReportFile,
  sanitizeReportFileName,
  saveLabReportFile,
} from "@/lib/lab-report-store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const { id } = await context.params;
  const order = await prisma.labOrder.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
  });
  if (!order?.reportFileName || !order.reportMimeType) {
    return NextResponse.json({ error: "No report has been uploaded yet." }, { status: 404 });
  }
  const canView =
    LAB_REPORT_VIEW_ROLES.includes(scoped.user.role) ||
    LAB_WORK_ROLES.includes(scoped.user.role) ||
    (order.fulfillment === "EXTERNAL" && EXTERNAL_REPORT_UPLOAD_ROLES.includes(scoped.user.role));
  if (!canView) {
    return NextResponse.json({ error: "You cannot open this report." }, { status: 403 });
  }
  if (scoped.user.role === "LAB_TECH" && order.status === "RESULTED") {
    return NextResponse.json({ error: "This report is on the patient record for the doctor and nurse." }, { status: 403 });
  }

  const bytes = await readLabReportFile(order.hospitalId, order.id);
  if (!bytes) {
    return NextResponse.json({ error: "Report file is missing." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": order.reportMimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(order.reportFileName)}"`,
    },
  });
}

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const { id } = await context.params;
  const order = await prisma.labOrder.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId },
    include: {
      patient: true,
      appointment: { include: { doctor: { select: { appUserId: true } } } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Lab order not found." }, { status: 404 });
  }

  const external = order.fulfillment === "EXTERNAL";
  const allowed = external
    ? EXTERNAL_REPORT_UPLOAD_ROLES.includes(scoped.user.role)
    : LAB_WORK_ROLES.includes(scoped.user.role);
  if (!allowed) {
    return NextResponse.json({ error: "You cannot upload this report." }, { status: 403 });
  }
  if (external) {
    if (order.status === "CANCELLED") {
      return NextResponse.json({ error: "This investigation was cancelled." }, { status: 409 });
    }
  } else if (order.status === "AWAITING_PAYMENT" || order.status === "CANCELLED") {
    return NextResponse.json({ error: "Collect payment before uploading a report." }, { status: 409 });
  }
  if (order.status === "RESULTED" && scoped.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "This order is already marked done." }, { status: 409 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a PDF or image to upload." }, { status: 400 });
  }
  if (!isAllowedLabReport(file.type, file.size)) {
    return NextResponse.json({ error: "Upload a PDF, JPG, or PNG up to 8 MB." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await saveLabReportFile(order.hospitalId, order.id, bytes);
  const fileName = sanitizeReportFileName(file.name);
  const now = new Date();

  const updated = await prisma.labOrder.update({
    where: { id: order.id },
    data: {
      reportFileName: fileName,
      reportMimeType: file.type,
      reportSize: file.size,
      reportUploadedAt: now,
      reportUploadedByUsername: scoped.user.username,
      sampleCollectedAt: order.sampleCollectedAt ?? now,
      sampleCollectedBy: order.sampleCollectedBy ?? scoped.user.username,
      status: external ? "RESULTED" : order.status === "PAID" ? "SAMPLE_COLLECTED" : order.status,
      resultedAt: external ? now : order.resultedAt,
    },
  });

  if (external && order.status !== "RESULTED") {
    await notifyLabResults({
      hospitalId: scoped.user.hospitalId,
      appointmentId: order.appointmentId,
      orderId: order.id,
      patientId: order.patientId,
      patientName: patientName(order.patient),
      doctorUserId: order.appointment?.doctor.appUserId ?? null,
      external: true,
    });
  }

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: external ? "EXTERNAL_REPORT_UPLOADED" : "LAB_REPORT_UPLOADED",
    entity: "LabOrder",
    entityId: order.id,
    summary: `${scoped.user.username} uploaded ${external ? "outside" : "lab"} report ${fileName} for ${patientName(order.patient)}.`,
  });

  return NextResponse.json({
    ok: true,
    order: {
      id: updated.id,
      status: updated.status,
      reportFileName: updated.reportFileName,
    },
  });
}
