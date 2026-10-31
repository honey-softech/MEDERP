import { NextRequest, NextResponse } from "next/server";
import { resolveDoctorStaffId } from "@/lib/appointments/doctor-staff";
import { requireHospitalActor } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

function templateJson(row: { id: string; name: string; diagnosis: string; prescription: string }) {
  return {
    id: row.id,
    name: row.name,
    diagnosis: row.diagnosis,
    prescription: row.prescription,
  };
}

export async function GET() {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const doctorId = await resolveDoctorStaffId(scoped.user);
  if (!doctorId) return NextResponse.json({ templates: [] });

  const rows = await prisma.rxTemplate.findMany({
    where: { hospitalId: scoped.user.hospitalId, doctorId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, diagnosis: true, prescription: true },
  });
  return NextResponse.json({ templates: rows.map(templateJson) });
}

export async function POST(request: NextRequest) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const doctorId = await resolveDoctorStaffId(scoped.user);
  if (!doctorId) {
    return NextResponse.json({ error: "Only a doctor can save a prescription template." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    diagnosis?: unknown;
    prescription?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const diagnosis = typeof body?.diagnosis === "string" ? body.diagnosis.trim() : "";
  const prescription = typeof body?.prescription === "string" ? body.prescription.trim() : "";
  if (!name || !diagnosis || !prescription) {
    return NextResponse.json({ error: "Name, diagnosis, and prescription are required." }, { status: 400 });
  }
  if (name.length > 80 || diagnosis.length > 200 || prescription.length > 8000) {
    return NextResponse.json({ error: "Template is too long." }, { status: 400 });
  }

  const row = await prisma.rxTemplate.create({
    data: {
      hospitalId: scoped.user.hospitalId,
      doctorId,
      name,
      diagnosis,
      prescription,
    },
    select: { id: true, name: true, diagnosis: true, prescription: true },
  });
  return NextResponse.json({ template: templateJson(row) });
}
