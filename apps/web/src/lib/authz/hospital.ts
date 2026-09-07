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
export const NURSE_VITALS_ROLES: AppRole[] = ["SUPER_ADMIN", "NURSE"];
export const DOCTOR_VISIT_ROLES: AppRole[] = ["SUPER_ADMIN", "DOCTOR"];
export const PRINT_SUMMARY_ROLES: AppRole[] = ["SUPER_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"];
export const BILLING_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST", "ACCOUNTANT", "DOCTOR"];
export const WAIVER_APPROVER_ROLES: AppRole[] = ["SUPER_ADMIN", "ACCOUNTANT"];
export const LAB_WORK_ROLES: AppRole[] = ["SUPER_ADMIN", "LAB_TECH"];
export const LAB_VIEW_ROLES: AppRole[] = ["SUPER_ADMIN", "LAB_TECH", "DOCTOR", "NURSE", "RECEPTIONIST"];
export const LAB_REPORT_VIEW_ROLES: AppRole[] = ["DOCTOR", "NURSE"];
export const EXTERNAL_REPORT_UPLOAD_ROLES: AppRole[] = ["SUPER_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"];
export { PHARMACY_ROLES } from "@/lib/pharmacy";

type WalkInPolicy = {
  walkInByDoctor?: boolean | null;
  walkInByNurse?: boolean | null;
};

export function walkInRolesFor(hospital?: WalkInPolicy | null): AppRole[] {
  const roles: AppRole[] = [...WALK_IN_BASE_ROLES];
  if (hospital?.walkInByDoctor !== false) roles.push("DOCTOR");
  if (hospital?.walkInByNurse) roles.push("NURSE");
  return roles;
}

export function canAddWalkIn(user: { role: AppRole; hospital?: WalkInPolicy | null }) {
  return walkInRolesFor(user.hospital).includes(user.role);
}

export function canRegisterPatient(user: { role: AppRole; hospital?: WalkInPolicy | null }) {
  return PATIENT_REGISTER_ROLES.includes(user.role) || canAddWalkIn(user);
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

export function forbidUnless(role: AppRole, roles: AppRole[]) {
  if (!roles.includes(role)) {
    return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
  }
  return null;
}
