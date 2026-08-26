import { NextResponse } from "next/server";
import type { AppRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES, getCurrentUser, hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { isValidIndianMobile, normalizeMobile } from "@/lib/phone";
import { writeAuditLog } from "@/lib/audit";
import {
  generateStaffPassword,
  nextUserCode,
  parseEmployeeBody,
  suggestedUsername,
  uniqueUsername,
  upsertEmployeeStaff,
} from "@/lib/employee";
import { assertStaffSeatAvailable } from "@/lib/platform-billing";
import { moduleErrorForRole } from "@/lib/platform-pricing";

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SUPER_ADMIN" || !actor.hospitalId) {
    return NextResponse.json({ error: "Hospital super admin access required." }, { status: 403 });
  }

  const users = await prisma.appUser.findMany({
    where: { hospitalId: actor.hospitalId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userCode: true,
      employeeId: true,
      username: true,
      firstName: true,
      lastName: true,
      mobile: true,
      email: true,
      role: true,
      isVerified: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ hospital: actor.hospital, users });
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const isPlatformAdmin = actor.role === "SOFTWARE_ADMIN";
    const hospitalId = isPlatformAdmin
      ? String(body?.hospitalId ?? "").trim()
      : actor.role === "SUPER_ADMIN"
        ? actor.hospitalId
        : null;
    if (!hospitalId || (!isPlatformAdmin && actor.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Hospital admin access required." }, { status: 403 });
    }

    const role = String(body?.role ?? "RECEPTIONIST") as AppRole;
    const allowedRoles: AppRole[] = isPlatformAdmin ? ["SUPER_ADMIN", ...STAFF_ROLES] : STAFF_ROLES;
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: isPlatformAdmin ? "Select a valid hospital role." : "Super admin can only add hospital staff roles." },
        { status: 400 },
      );
    }

    const parsed = parseEmployeeBody(body, role);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const input = parsed.value;
    const mobile = normalizeMobile(input.mobile);
    if (!isValidIndianMobile(mobile)) {
      return NextResponse.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { pharmacyEnabled: true, labEnabled: true },
    });
    if (!hospital) {
      return NextResponse.json({ error: "Hospital not found." }, { status: 404 });
    }
    if (role !== "SUPER_ADMIN") {
      const moduleError = moduleErrorForRole(role, hospital);
      if (moduleError) {
        return NextResponse.json({ error: moduleError }, { status: 403 });
      }
    }

    if (role !== "SUPER_ADMIN") {
      try {
        await assertStaffSeatAvailable(hospitalId);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Staff limit reached." },
          { status: 403 },
        );
      }
    }

    const password = String(body?.password ?? "").trim();
    if (password && password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 },
      );
    }
    const generatedPassword = password.length >= MIN_PASSWORD_LENGTH ? null : generateStaffPassword();
    const passwordToHash = password.length >= MIN_PASSWORD_LENGTH ? password : generatedPassword!;

    const username = await uniqueUsername(input.username || suggestedUsername(input.firstName, input.lastName));
    const clash = await prisma.appUser.findFirst({
      where: {
        OR: [
          { username },
          { mobile },
          ...(input.employeeId ? [{ hospitalId, employeeId: input.employeeId }] : []),
        ],
      },
    });
    if (clash) {
      return NextResponse.json({ error: "Username, mobile, or employee ID is already registered." }, { status: 409 });
    }

    if (input.departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: input.departmentId, hospitalId },
        select: { id: true },
      });
      if (!department) {
        return NextResponse.json({ error: "Department must belong to this hospital." }, { status: 400 });
      }
    }

    const userCode = await nextUserCode(hospitalId, role);
    const user = await prisma.appUser.create({
      data: {
        username,
        mobile,
        passwordHash: await hashPassword(passwordToHash),
        otpCode: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        isVerified: true,
        isActive: input.isActive,
        role,
        hospitalId,
        userCode,
        employeeId: input.employeeId,
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        photoData: input.photoData,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        email: input.email,
        dateJoined: input.dateJoined,
        employmentType: input.employmentType,
        preferredLanguage: input.preferredLanguage,
        timezone: input.timezone,
      },
      select: { id: true, username: true, mobile: true, role: true, userCode: true, employeeId: true },
    });

    if (role !== "SUPER_ADMIN") {
      await upsertEmployeeStaff({
        hospitalId,
        appUserId: user.id,
        input: { ...input, mobile, username },
      });
    }

    await writeAuditLog({
      request,
      hospitalId,
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: "USER_CREATED",
      entity: "AppUser",
      entityId: user.id,
      summary: `${actor.username} added ${input.firstName} ${input.lastName} (${user.userCode}) as ${user.role.replace(/_/g, " ")}.`,
      metadata: { mobile: user.mobile, role: user.role, employeeId: user.employeeId },
    });

    return NextResponse.json({ ok: true, user, generatedPassword });
  } catch (error) {
    console.error("Failed to create hospital user", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create user." },
      { status: 500 },
    );
  }
}
