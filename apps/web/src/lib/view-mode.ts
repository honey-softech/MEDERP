import { cookies } from "next/headers";
import type { AppRole } from "@prisma/client";

export const VIEW_MODE_COOKIE = "mederp_view_mode";
export type ViewMode = "admin" | "doctor";

export type SessionStaffProfile = {
  id: string;
  role: string;
  isActive: boolean;
} | null;

export type ViewUser = {
  id: string;
  role: AppRole;
  hospitalId?: string | null;
  staffProfile?: SessionStaffProfile;
};

export type ViewContext = {
  canActAsDoctor: boolean;
  mode: ViewMode;
  doctorStaffId: string | null;
};

export function parseViewMode(value: string | null | undefined): ViewMode | null {
  if (value === "admin" || value === "doctor") return value;
  return null;
}

/** Hospital SUPER_ADMIN with an active linked doctor Staff profile. */
export function canUserActAsDoctor(user: ViewUser | null | undefined): boolean {
  if (!user || user.role !== "SUPER_ADMIN") return false;
  const staff = user.staffProfile;
  return Boolean(staff && staff.role === "DOCTOR" && staff.isActive);
}

export function doctorStaffIdFor(user: ViewUser | null | undefined): string | null {
  if (!canUserActAsDoctor(user)) return null;
  return user?.staffProfile?.id ?? null;
}

export async function resolveViewContext(user: ViewUser | null | undefined): Promise<ViewContext> {
  const canActAsDoctor = canUserActAsDoctor(user);
  const doctorStaffId = canActAsDoctor ? (user?.staffProfile?.id ?? null) : null;
  if (!canActAsDoctor) {
    return { canActAsDoctor: false, mode: "admin", doctorStaffId: null };
  }
  const jar = await cookies();
  const cookieMode = parseViewMode(jar.get(VIEW_MODE_COOKIE)?.value);
  return {
    canActAsDoctor: true,
    mode: cookieMode ?? "doctor",
    doctorStaffId,
  };
}
