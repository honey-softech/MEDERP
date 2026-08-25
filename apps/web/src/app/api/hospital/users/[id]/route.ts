import { NextResponse } from "next/server";
import type { AppRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES, getCurrentUser, hashPassword } from "@/lib/auth";
import { isValidIndianMobile, normalizeMobile } from "@/lib/phone";
import { writeAuditLog } from "@/lib/audit";
import { parseEmployeeBody, suggestedUsername, uniqueUsername, upsertEmployeeStaff } from "@/lib/employee";

type Ctx = { params: Promise<{ id: string }> };

async function requireHospitalSuperAdmin() {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "SUPER_ADMIN" || !actor.hospitalId) {
    return { error: NextResponse.json({ error: "Hospital super admin access required." }, { status: 403 }) };
  }
  return { actor: { ...actor, hospitalId: actor.hospitalId } };
}

export async function PATCH(request: Request, context: Ctx) {
  const scoped = await requireHospitalSuperAdmin();
  if (scoped.error) return scoped.error;
  const actor = scoped.actor;

  try {
    const { id } = await context.params;
    const existing = await prisma.appUser.findFirst({
      where: { id, hospitalId: actor.hospitalId },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (existing.role === "SOFTWARE_ADMIN" || existing.role === "HELPDESK") {
      return NextResponse.json({ error: "This account cannot be edited here." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const requestedRole = String(body?.role ?? existing.role) as AppRole;
    let role = existing.role as Exclude<AppRole, "SOFTWARE_ADMIN" | "HELPDESK">;
    if (existing.role === "SUPER_ADMIN") {
      role = "SUPER_ADMIN";
    } else if ((STAFF_ROLES as readonly AppRole[]).includes(requestedRole)) {
      role = requestedRole as Exclude<AppRole, "SOFTWARE_ADMIN" | "HELPDESK" | "SUPER_ADMIN">;
    } else {
      return NextResponse.json({ error: "Select a valid hospital staff role." }, { status: 400 });
    }

    const parsed = parseEmployeeBody({ ...body, firstName: body?.firstName ?? existing.firstName, lastName: body?.lastName ?? existing.lastName, employeeId: body?.employeeId ?? existing.employeeId, email: body?.email ?? existing.email }, role);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const input = parsed.value;
    const mobile = normalizeMobile(input.mobile || existing.mobile);
    if (!isValidIndianMobile(mobile)) {
      return NextResponse.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
    }
    if (existing.id === actor.id && (!input.isActive || !input.isVerified)) {
      return NextResponse.json({ error: "You cannot disable your own login." }, { status: 400 });
    }

    const password = String(body?.password ?? "");
    if (password && password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const username = await uniqueUsername(
      input.username || existing.username || suggestedUsername(input.firstName, input.lastName),
      id,
    );

    const clash = await prisma.appUser.findFirst({
      where: {
        id: { not: id },
        OR: [
          { username },
          { mobile },
          ...(input.employeeId
            ? [{ hospitalId: actor.hospitalId, employeeId: input.employeeId }]
            : []),
        ],
      },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json({ error: "Username, mobile, or employee ID is already registered." }, { status: 409 });
    }

    const user = await prisma.appUser.update({
      where: { id },
      data: {
        username,
        mobile,
        role,
        isVerified: input.isVerified,
        isActive: input.isActive,
        employeeId: input.employeeId || null,
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
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
      },
      select: { id: true, username: true, mobile: true, role: true, isVerified: true, userCode: true },
    });

    if (role !== "SUPER_ADMIN") {
      await upsertEmployeeStaff({
        hospitalId: actor.hospitalId,
        appUserId: user.id,
        input: { ...input, role, mobile, username },
      });
    }

    await writeAuditLog({
      request,
      hospitalId: actor.hospitalId,
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: "USER_UPDATED",
      entity: "AppUser",
      entityId: user.id,
      summary: `${actor.username} updated hospital user ${input.firstName} ${input.lastName} (${user.role.replace(/_/g, " ")}).`,
      metadata: { mobile: user.mobile, role: user.role, passwordReset: Boolean(password) },
    });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    console.error("Failed to update hospital user", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save user." },
      { status: 500 },
    );
  }
}
