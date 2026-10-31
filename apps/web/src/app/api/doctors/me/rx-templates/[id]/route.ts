import { NextResponse } from "next/server";
import { resolveDoctorStaffId } from "@/lib/appointments/doctor-staff";
import { requireHospitalActor } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const doctorId = await resolveDoctorStaffId(scoped.user);
  if (!doctorId) {
    return NextResponse.json({ error: "Only a doctor can remove a prescription template." }, { status: 403 });
  }
  const { id } = await context.params;
  const existing = await prisma.rxTemplate.findFirst({
    where: { id, hospitalId: scoped.user.hospitalId, doctorId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  await prisma.rxTemplate.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
