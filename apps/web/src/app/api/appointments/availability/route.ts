import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listSlotsForDoctorDate } from "@/lib/doctor-availability";
import { prisma } from "@/lib/prisma";
import { doctorIsOnLeave } from "@/lib/opd/scheduling";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.hospitalId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const doctorId = String(url.searchParams.get("doctorId") ?? "").trim();
  const date = String(url.searchParams.get("date") ?? "").trim();
  if (!doctorId || !date) {
    return NextResponse.json({ error: "doctorId and date (YYYY-MM-DD) are required." }, { status: 400 });
  }

  const doctor = await prisma.staff.findFirst({
    where: { id: doctorId, hospitalId: user.hospitalId, role: "DOCTOR", isActive: true },
    select: { id: true },
  });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
  }

  const result = await listSlotsForDoctorDate({ doctorId: doctor.id, dateIso: date });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const atNoon = new Date(`${date}T12:00:00`);
  const onLeave = await doctorIsOnLeave(user.hospitalId, doctor.id, atNoon);

  return NextResponse.json({
    doctorId: doctor.id,
    date,
    onLeave,
    ...result,
  });
}
