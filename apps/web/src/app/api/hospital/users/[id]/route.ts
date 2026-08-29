import { NextResponse } from "next/server";
import type { AppRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES, getCurrentUser, hashPassword, invalidateUserSessions, passwordValidationError } from "@/lib/auth";
import { isValidIndianMobile, normalizeMobile } from "@/lib/phone";
import { diffAuditFields, writeAuditLog } from "@/lib/audit";
import { parseEmployeeBody, suggestedUsername, uniqueUsername, upsertEmployeeStaff, nextEmployeeId, nextUserCode } from "@/lib/employee";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const isPlatformAdmin = actor.role === "SOFTWARE_ADMIN";
  if (!isPlatformAdmin && (actor.role !== "SUPER_ADMIN" || !actor.hospitalId)) {
    return NextResponse.json({ error: "Hospital admin access required." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const existing = await prisma.appUser.findFirst({
      where: isPlatformAdmin ? { id } : { id, hospitalId: actor.hospitalId! },
    });
    if (!existing || !existing.hospitalId) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (existing.role === "SOFTWARE_ADMIN" || existing.role === "HELPDESK") {
      return NextResponse.json({ error: "This account cannot be edited here." }, { status: 403 });
    }

    const hospitalId = existing.hospitalId;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const requestedRole = String(body?.role ?? existing.role) as AppRole;
    let role = existing.role as Exclude<AppRole, "SOFTWARE_ADMIN" | "HELPDESK">;

    if (isPlatformAdmin) {
      const allowed: AppRole[] = ["SUPER_ADMIN", ...STAFF_ROLES];
      if (!allowed.includes(requestedRole)) {
        return NextResponse.json({ error: "Select a valid hospital role." }, { status: 400 });
      }
      role = requestedRole as Exclude<AppRole, "SOFTWARE_ADMIN" | "HELPDESK">;
    } else if (existing.role === "SUPER_ADMIN") {
      role = "SUPER_ADMIN";
    } else if ((STAFF_ROLES as readonly AppRole[]).includes(requestedRole)) {
      role = requestedRole as Exclude<AppRole, "SOFTWARE_ADMIN" | "HELPDESK" | "SUPER_ADMIN">;
    } else {
      return NextResponse.json({ error: "Select a valid hospital staff role." }, { status: 400 });
    }

    const parsed = parseEmployeeBody(
      {
        ...body,
        firstName: body?.firstName ?? existing.firstName,
        lastName: body?.lastName ?? existing.lastName,
        employeeId: existing.employeeId,
        email: body?.email ?? existing.email,
      },
      role,
    );
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
    if (password) {
      const passwordError = passwordValidationError(password);
      if (passwordError) {
        return NextResponse.json({ error: passwordError }, { status: 400 });
      }
    }

    const username = await uniqueUsername(
      input.username || existing.username || suggestedUsername(input.firstName, input.lastName),
      id,
    );

    const clash = await prisma.appUser.findFirst({
      where: {
        id: { not: id },
        OR: [{ username }, { mobile }],
      },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json({ error: "Username, mobile, or employee ID is already registered." }, { status: 409 });
    }

    const roleChanged = role !== existing.role;
    const deactivated = existing.isActive !== false && input.isActive === false;
    const passwordChanged = Boolean(password);
    const userCode = existing.userCode ?? (await nextUserCode(hospitalId, role));
    const employeeId = existing.employeeId ?? (await nextEmployeeId(hospitalId));

    const user = await prisma.appUser.update({
      where: { id },
      data: {
        username,
        mobile,
        role,
        isVerified: input.isVerified,
        isActive: input.isActive,
        userCode,
        employeeId,
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

    if (passwordChanged || roleChanged || deactivated) {
      await invalidateUserSessions(user.id);
    }

    if (role !== "SUPER_ADMIN") {
      await upsertEmployeeStaff({
        hospitalId,
        appUserId: user.id,
        input: { ...input, role, mobile, username },
      });
    }

    const after = {
      username,
      mobile,
      role,
      isVerified: input.isVerified,
      isActive: input.isActive,
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
      passwordHash: passwordChanged ? "updated" : existing.passwordHash,
    };
    const changes = diffAuditFields(existing as unknown as Record<string, unknown>, after, {
      fields: [
        "username",
        "mobile",
        "role",
        "isVerified",
        "isActive",
        "firstName",
        "middleName",
        "lastName",
        "photoData",
        "dateOfBirth",
        "gender",
        "email",
        "dateJoined",
        "employmentType",
        "preferredLanguage",
        "timezone",
        "passwordHash",
      ],
    });

    await writeAuditLog({
      request,
      hospitalId,
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      action: "USER_UPDATED",
      entity: "AppUser",
      entityId: user.id,
      summary: `${actor.username} updated hospital user ${input.firstName} ${input.lastName} (${user.role.replace(/_/g, " ")}).`,
      metadata: { mobile: user.mobile, role: user.role, passwordReset: Boolean(password), changes },
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
