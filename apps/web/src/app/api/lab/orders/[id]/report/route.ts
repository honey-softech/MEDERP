import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { patientName, requireHospitalActor } from "@/lib/front-desk";
import { notifyLabResults } from "@/lib/lab";
import { assertLabReportSources, combineLabReportFiles } from "@/lib/lab-report-combine";
import { readLabReportFile, saveLabReportFile } from "@/lib/lab-report-store";
import { canUploadLabReport, canViewLabReport } from "@/lib/lab-orders/rules";
import { hospitalScope } from "@/lib/tenancy";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const { id } = await context.params;
  const order = await prisma.labOrder.findFirst({
    where: { id, ...hospitalScope(scoped.user.hospitalId) },
  });
  if (!order?.reportFileName || !order.reportMimeType) {
    return NextResponse.json({ error: "No report has been uploaded yet." }, { status: 404 });
  }
  const view = canViewLabReport({
    role: scoped.user.role,
    fulfillment: order.fulfillment,
    status: order.status,
  });
  if (!view.ok) {
    return NextResponse.json({ error: view.error }, { status: view.status });
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

async function collectUploadFiles(form: FormData) {
  const entries = [
    ...form.getAll("files"),
    ...form.getAll("file"),
  ].filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const unique: File[] = [];
  const seen = new Set<string>();
  for (const file of entries) {
    const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(file);
  }
  return unique;
}

export async function POST(request: Request, context: Ctx) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const { id } = await context.params;
  const order = await prisma.labOrder.findFirst({
    where: { id, ...hospitalScope(scoped.user.hospitalId) },
    include: {
      patient: true,
      appointment: { include: { doctor: { select: { appUserId: true } } } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Lab order not found." }, { status: 404 });
  }

  const allowed = canUploadLabReport({
    role: scoped.user.role,
    fulfillment: order.fulfillment,
    status: order.status,
  });
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  }
  const external = order.fulfillment === "EXTERNAL";
  const handCarriedByClinical = ["DOCTOR", "NURSE", "RECEPTIONIST"].includes(scoped.user.role);
  const markResulted = external || handCarriedByClinical;

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Choose a PDF or image to upload." }, { status: 400 });
  }
  const uploads = await collectUploadFiles(form);
  const sources = await Promise.all(
    uploads.map(async (file) => ({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes: Buffer.from(await file.arrayBuffer()),
    })),
  );
  const sourceError = assertLabReportSources(sources);
  if (sourceError) {
    return NextResponse.json({ error: sourceError }, { status: 400 });
  }

  let combined;
  try {
    combined = await combineLabReportFiles(sources);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not combine the report files." },
      { status: 400 },
    );
  }

  await saveLabReportFile(order.hospitalId, order.id, combined.bytes);
  const fileName = combined.fileName;
  const now = new Date();

  const updated = await prisma.labOrder.update({
    where: { id: order.id },
    data: {
      reportFileName: fileName,
      reportMimeType: combined.mimeType,
      reportSize: combined.bytes.length,
      reportUploadedAt: now,
      reportUploadedByUsername: scoped.user.username,
      sampleCollectedAt: order.sampleCollectedAt ?? now,
      sampleCollectedBy: order.sampleCollectedBy ?? scoped.user.username,
      status: markResulted ? "RESULTED" : order.status === "PAID" ? "SAMPLE_COLLECTED" : order.status,
      resultedAt: markResulted ? now : order.resultedAt,
    },
  });

  if (markResulted && order.status !== "RESULTED") {
    await notifyLabResults({
      hospitalId: scoped.user.hospitalId,
      appointmentId: order.appointmentId,
      orderId: order.id,
      patientId: order.patientId,
      patientName: patientName(order.patient),
      doctorUserId: order.appointment?.doctor.appUserId ?? null,
      external: external || handCarriedByClinical,
    });
  }

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: external || handCarriedByClinical ? "EXTERNAL_REPORT_UPLOADED" : "LAB_REPORT_UPLOADED",
    entity: "LabOrder",
    entityId: order.id,
    summary: `${scoped.user.username} uploaded ${external || handCarriedByClinical ? "hand-carried/outside" : "lab"} report ${fileName} (${sources.length} file${sources.length === 1 ? "" : "s"}) for ${patientName(order.patient)}.`,
    metadata: {
      changes: diffAuditFields(
        { reportFileName: order.reportFileName, status: order.status },
        { reportFileName: updated.reportFileName, status: updated.status },
        { fields: ["reportFileName", "status"] },
      ),
      pageCount: sources.length,
    },
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
