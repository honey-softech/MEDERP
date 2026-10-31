import { NextResponse } from "next/server";
import { clinicDayKey, rankTerms } from "@/lib/appointments/frequent-terms";
import { resolveDoctorStaffId } from "@/lib/appointments/doctor-staff";
import { requireHospitalActor } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

type FrequentPayload = {
  diagnoses: string[];
  complaints: string[];
  advice: string[];
};

const cache = new Map<string, { day: string; payload: FrequentPayload }>();

const empty: FrequentPayload = { diagnoses: [], complaints: [], advice: [] };

export async function GET() {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;

  const doctorId = await resolveDoctorStaffId(scoped.user);
  if (!doctorId) return NextResponse.json(empty);

  const day = clinicDayKey();
  const key = `${scoped.user.hospitalId}:${doctorId}`;
  const cached = cache.get(key);
  if (cached?.day === day) return NextResponse.json(cached.payload);

  const since = new Date();
  since.setDate(since.getDate() - 90);
  const rows = await prisma.visitAssessment.findMany({
    where: {
      hospitalId: scoped.user.hospitalId,
      createdAt: { gte: since },
      appointment: { doctorId },
    },
    select: { diagnosis: true, chiefComplaint: true, advice: true },
  });

  const payload: FrequentPayload = {
    diagnoses: rankTerms(rows.map((row) => row.diagnosis)),
    complaints: rankTerms(rows.map((row) => row.chiefComplaint)),
    advice: rankTerms(rows.map((row) => row.advice)),
  };
  cache.set(key, { day, payload });
  return NextResponse.json(payload);
}
