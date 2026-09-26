import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  linkAdminToExistingDoctorStaff,
  parseEmployeeBody,
  upsertAdminDoctorStaff,
} from "@/lib/employee";
import { requireHospitalActor } from "@/lib/front-desk";
import { assertSeatIfAdminBecomesDoctor } from "@/lib/platform-billing";

function dateIso(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function decimalString(value: { toString(): string } | number | null | undefined) {
  if (value == null) return "";
  return String(value);
}

function staffToProfile(staff: {
  isActive: boolean;
  departmentId: string | null;
  opdRoom: string | null;
  shift: string | null;
  weeklySchedule: string | null;
  medicalRegNo: string | null;
  regCouncil: string | null;
  regRegion: string | null;
  regIssuedAt: Date | null;
  regExpiresAt: Date | null;
  medicalDegree: string | null;
  university: string | null;
  graduationYear: number | null;
  postgraduate: string | null;
  fellowship: string | null;
  specialization: string | null;
  subSpecialization: string | null;
  yearsExperience: number | null;
  areasOfExpertise: string | null;
  languagesSpoken: string | null;
  consultationType: string | null;
  consultationFee: { toString(): string } | null;
  followUpFee: { toString(): string } | null;
  teleconsultEnabled: boolean;
  emergencyDutyEnabled: boolean;
  firstName: string;
  lastName: string;
}) {
  return {
    enabled: staff.isActive,
    departmentId: staff.departmentId ?? "",
    opdRoom: staff.opdRoom ?? "",
    shift: staff.shift ?? "",
    weeklySchedule: staff.weeklySchedule ?? "",
    medicalRegNo: staff.medicalRegNo ?? "",
    regCouncil: staff.regCouncil ?? "",
    regRegion: staff.regRegion ?? "",
    regIssuedAt: dateIso(staff.regIssuedAt),
    regExpiresAt: dateIso(staff.regExpiresAt),
    medicalDegree: staff.medicalDegree ?? "",
    university: staff.university ?? "",
    graduationYear: staff.graduationYear != null ? String(staff.graduationYear) : "",
    postgraduate: staff.postgraduate ?? "",
    fellowship: staff.fellowship ?? "",
    specialization: staff.specialization ?? "",
    subSpecialization: staff.subSpecialization ?? "",
    yearsExperience: staff.yearsExperience != null ? String(staff.yearsExperience) : "",
    areasOfExpertise: staff.areasOfExpertise ?? "",
    languagesSpoken: staff.languagesSpoken ?? "",
    consultationType: staff.consultationType ?? "",
    consultationFee: decimalString(staff.consultationFee),
    followUpFee: decimalString(staff.followUpFee),
    teleconsultEnabled: staff.teleconsultEnabled,
    emergencyDutyEnabled: staff.emergencyDutyEnabled,
    firstName: staff.firstName,
    lastName: staff.lastName,
  };
}

export async function GET() {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  if (scoped.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hospital admin access required." }, { status: 403 });
  }

  const hospital = await prisma.hospital.findUnique({
    where: { id: scoped.user.hospitalId },
    select: { id: true },
  });
  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found." }, { status: 404 });
  }

  const [staff, doctors] = await Promise.all([
    prisma.staff.findUnique({ where: { appUserId: scoped.user.id } }),
    prisma.staff.findMany({
      where: { hospitalId: scoped.user.hospitalId, role: "DOCTOR" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        specialization: true,
        medicalRegNo: true,
        isActive: true,
        appUserId: true,
        department: { select: { name: true, code: true } },
        appUser: { select: { username: true, role: true, isActive: true } },
      },
    }),
  ]);

  const doctorProfile = staff && staff.role === "DOCTOR" ? staffToProfile(staff) : null;

  return NextResponse.json({
    ok: true,
    profile: doctorProfile,
    linkedStaffId: staff && staff.role === "DOCTOR" ? staff.id : null,
    doctors: doctors.map((row) => ({
      id: row.id,
      label: `${row.firstName} ${row.lastName}`.trim(),
      specialization: row.specialization ?? "",
      medicalRegNo: row.medicalRegNo ?? "",
      department: row.department ? `${row.department.name} (${row.department.code})` : "",
      isActive: row.isActive,
      linkedToAdmin: row.appUserId === scoped.user.id,
      linkedUsername: row.appUser?.username ?? null,
      linkedRole: row.appUser?.role ?? null,
    })),
    user: {
      firstName: scoped.user.firstName ?? "",
      lastName: scoped.user.lastName ?? "",
      mobile: scoped.user.mobile,
      email: scoped.user.email ?? "",
    },
  });
}

export async function PUT(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  if (scoped.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Hospital admin access required." }, { status: 403 });
  }

  const hospital = await prisma.hospital.findUnique({
    where: { id: scoped.user.hospitalId },
    select: { id: true },
  });
  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const enabled = Boolean(body.enabled);
  const existing = await prisma.staff.findUnique({ where: { appUserId: scoped.user.id } });

  if (!enabled) {
    if (existing && existing.role === "DOCTOR") {
      await prisma.staff.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
      await writeAuditLog({
        request,
        hospitalId: scoped.user.hospitalId,
        actorUserId: scoped.user.id,
        actorUsername: scoped.user.username,
        actorRole: scoped.user.role,
        action: "ADMIN_DOCTOR_DISABLED",
        entity: "Staff",
        entityId: existing.id,
        summary: `${scoped.user.username} disabled their admin-as-doctor profile.`,
      });
    }
    return NextResponse.json({ ok: true, enabled: false });
  }

  const mode = String(body.mode ?? "create").trim().toLowerCase() === "link" ? "link" : "create";
  const adminAlreadyActiveDoctor = Boolean(existing && existing.role === "DOCTOR" && existing.isActive);

  if (mode === "link") {
    const staffId = String(body.staffId ?? "").trim();
    if (!staffId) {
      return NextResponse.json({ error: "Select an existing doctor." }, { status: 400 });
    }

    const target = await prisma.staff.findFirst({
      where: { id: staffId, hospitalId: scoped.user.hospitalId, role: "DOCTOR" },
      select: { appUser: { select: { id: true, role: true, isActive: true } } },
    });
    const freesAnotherActiveLogin = Boolean(
      target?.appUser &&
        target.appUser.role === "DOCTOR" &&
        target.appUser.isActive &&
        target.appUser.id !== scoped.user.id,
    );
    try {
      await assertSeatIfAdminBecomesDoctor(scoped.user.hospitalId, {
        adminAlreadyActiveDoctor,
        freesAnotherActiveLogin,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Staff limit reached." },
        { status: 403 },
      );
    }

    const linked = await linkAdminToExistingDoctorStaff({
      hospitalId: scoped.user.hospitalId,
      adminUserId: scoped.user.id,
      staffId,
    });
    if (!linked.ok) {
      return NextResponse.json({ error: linked.error }, { status: linked.status });
    }

    await writeAuditLog({
      request,
      hospitalId: scoped.user.hospitalId,
      actorUserId: scoped.user.id,
      actorUsername: scoped.user.username,
      actorRole: scoped.user.role,
      action: "ADMIN_DOCTOR_LINKED",
      entity: "Staff",
      entityId: linked.staff.id,
      summary: `${scoped.user.username} linked admin login to existing doctor ${linked.staff.firstName} ${linked.staff.lastName}.`,
      metadata: {
        staffId: linked.staff.id,
        previousDoctorUserId: linked.previousDoctorUserId,
      },
    });

    return NextResponse.json({
      ok: true,
      enabled: true,
      mode: "link",
      staffId: linked.staff.id,
    });
  }

  const specialization = String(body.specialization ?? "").trim();
  const medicalRegNo = String(body.medicalRegNo ?? "").trim();
  if (!specialization) {
    return NextResponse.json({ error: "Specialization is required." }, { status: 400 });
  }
  if (!medicalRegNo) {
    return NextResponse.json({ error: "Medical registration number is required." }, { status: 400 });
  }

  const departmentId = String(body.departmentId ?? "").trim() || null;
  if (departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: departmentId, hospitalId: scoped.user.hospitalId },
      select: { id: true },
    });
    if (!dept) {
      return NextResponse.json({ error: "Select a valid department." }, { status: 400 });
    }
  }

  const firstName = String(body.firstName ?? scoped.user.firstName ?? "").trim() || scoped.user.username;
  const lastName = String(body.lastName ?? scoped.user.lastName ?? "").trim();
  const parsed = parseEmployeeBody(
    {
      ...body,
      firstName,
      lastName,
      mobile: scoped.user.mobile,
      email: body.email ?? scoped.user.email ?? "",
      username: scoped.user.username,
      specialization,
      medicalRegNo,
      departmentId,
      isActive: true,
    },
    "DOCTOR",
  );
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await assertSeatIfAdminBecomesDoctor(scoped.user.hospitalId, {
      adminAlreadyActiveDoctor,
      freesAnotherActiveLogin: false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Staff limit reached." },
      { status: 403 },
    );
  }

  const staff = await upsertAdminDoctorStaff({
    hospitalId: scoped.user.hospitalId,
    appUser: {
      id: scoped.user.id,
      username: scoped.user.username,
      mobile: scoped.user.mobile,
      email: scoped.user.email,
      firstName: scoped.user.firstName,
      lastName: scoped.user.lastName,
    },
    input: parsed.value,
    isActive: true,
  });

  await writeAuditLog({
    request,
    hospitalId: scoped.user.hospitalId,
    actorUserId: scoped.user.id,
    actorUsername: scoped.user.username,
    actorRole: scoped.user.role,
    action: existing ? "ADMIN_DOCTOR_UPDATED" : "ADMIN_DOCTOR_ENABLED",
    entity: "Staff",
    entityId: staff.id,
    summary: existing
      ? `${scoped.user.username} updated their admin-as-doctor profile.`
      : `${scoped.user.username} enabled their admin-as-doctor profile.`,
    metadata: {
      specialization: parsed.value.specialization,
      medicalRegNo: parsed.value.medicalRegNo,
      mode: "create",
    },
  });

  return NextResponse.json({ ok: true, enabled: true, mode: "create", staffId: staff.id });
}
