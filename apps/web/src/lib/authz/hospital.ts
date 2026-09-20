import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { AppRole } from "@prisma/client";
import { getCurrentUser, isPlatformRole } from "@/lib/auth";
import { hospitalAccessBlocked } from "@/lib/hospital-access";

export const FRONT_DESK_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST"];
export const WALK_IN_BASE_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST"];
export const WALK_IN_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST", "DOCTOR", "NURSE"];
export const PATIENT_REGISTER_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST", "DOCTOR"];
export const CLINICAL_VIEW_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST", "DOCTOR", "NURSE"];
export const NURSE_VITALS_ROLES: AppRole[] = ["NURSE"];
export const DOCTOR_VISIT_ROLES: AppRole[] = ["SUPER_ADMIN", "DOCTOR"];
export const PRINT_SUMMARY_ROLES: AppRole[] = ["SUPER_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"];
export const BILLING_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST", "ACCOUNTANT", "DOCTOR"];
export const WAIVER_APPROVER_ROLES: AppRole[] = ["SUPER_ADMIN", "ACCOUNTANT"];
export const LAB_WORK_ROLES: AppRole[] = ["SUPER_ADMIN", "LAB_TECH"];
export const LAB_VIEW_ROLES: AppRole[] = ["SUPER_ADMIN", "LAB_TECH", "DOCTOR", "NURSE", "RECEPTIONIST"];
export const LAB_REPORT_VIEW_ROLES: AppRole[] = ["DOCTOR", "NURSE"];
export const EXTERNAL_REPORT_UPLOAD_ROLES: AppRole[] = ["SUPER_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"];
export { PHARMACY_ROLES } from "@/lib/pharmacy";

export type HospitalRolePolicy = {
  walkInByDoctor?: boolean | null;
  walkInByNurse?: boolean | null;
  nurseAsReceptionist?: boolean | null;
};

export function isNurseReceptionist(user: { role: AppRole; hospital?: HospitalRolePolicy | null }) {
  return user.role === "NURSE" && Boolean(user.hospital?.nurseAsReceptionist);
}

/** When Superadmin opts in, every nurse also receives receptionist-capable role lists. */
export function withNurseReceptionist(
  roles: readonly AppRole[],
  hospital?: HospitalRolePolicy | null,
): AppRole[] {
  if (!hospital?.nurseAsReceptionist) return [...roles];
  if (!roles.includes("RECEPTIONIST") || roles.includes("NURSE")) return [...roles];
  return [...roles, "NURSE"];
}

export function hasRoleAccess(
  user: { role: AppRole; hospital?: HospitalRolePolicy | null },
  roles: readonly AppRole[],
) {
  return withNurseReceptionist(roles, user.hospital).includes(user.role);
}

export function hasFrontDeskAccess(user: { role: AppRole; hospital?: HospitalRolePolicy | null }) {
  return hasRoleAccess(user, FRONT_DESK_ROLES);
}

export function hasBillingAccess(user: { role: AppRole; hospital?: HospitalRolePolicy | null }) {
  return hasRoleAccess(user, BILLING_ROLES);
}

export function walkInRolesFor(hospital?: HospitalRolePolicy | null): AppRole[] {
  const roles: AppRole[] = [...WALK_IN_BASE_ROLES];
  if (hospital?.walkInByDoctor !== false) roles.push("DOCTOR");
  if ((hospital?.walkInByNurse || hospital?.nurseAsReceptionist) && !roles.includes("NURSE")) {
    roles.push("NURSE");
  }
  return roles;
}

export function canAddWalkIn(user: { role: AppRole; hospital?: HospitalRolePolicy | null }) {
  return walkInRolesFor(user.hospital).includes(user.role);
}

export function canRegisterPatient(user: { role: AppRole; hospital?: HospitalRolePolicy | null }) {
  return hasRoleAccess(user, PATIENT_REGISTER_ROLES) || canAddWalkIn(user);
}

export type HospitalActor = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> & {
  hospitalId: string;
};

export type HospitalActorResult =
  | { error: NextResponse; user?: undefined }
  | { user: HospitalActor; error?: undefined };

export async function requireHospitalActor(options?: {
  allowExpiredTrial?: boolean;
}): Promise<HospitalActorResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }
  if (!user.hospitalId || isPlatformRole(user.role)) {
    return { error: NextResponse.json({ error: "Hospital access required." }, { status: 403 }) };
  }
  if (!options?.allowExpiredTrial && hospitalAccessBlocked(user.hospital)) {
    return {
      error: NextResponse.json(
        { error: "Your free trial has ended. Ask the hospital admin to subscribe.", code: "TRIAL_ENDED" },
        { status: 402 },
      ),
    };
  }
  return { user: user as HospitalActor };
}

export async function requireHospitalPage(options?: { allowExpiredTrial?: boolean }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isPlatformRole(user.role)) redirect("/");
  if (!user.hospitalId) redirect("/join");
  if (!options?.allowExpiredTrial && hospitalAccessBlocked(user.hospital)) {
    redirect(user.role === "SUPER_ADMIN" ? "/hospital/subscription" : "/subscribe");
  }
  return user as HospitalActor;
}

export function forbidUnless(
  roleOrUser: AppRole | { role: AppRole; hospital?: HospitalRolePolicy | null },
  roles: readonly AppRole[],
) {
  const role = typeof roleOrUser === "string" ? roleOrUser : roleOrUser.role;
  const allowed =
    typeof roleOrUser === "string" ? roles : withNurseReceptionist(roles, roleOrUser.hospital);
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
  }
  return null;
}
