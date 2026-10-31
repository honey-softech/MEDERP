import { staffIdForAppUser } from "@/lib/opd/scheduling";
import { isActingAsDoctor, resolveViewContext, type ViewUser } from "@/lib/view-mode";

type DoctorActor = ViewUser & {
  hospitalId?: string | null;
  staffProfile?: { id: string; role: string; isActive: boolean } | null;
};

/** Staff id of the doctor currently practising in this session. */
export async function resolveDoctorStaffId(user: DoctorActor): Promise<string | null> {
  if (user.role === "DOCTOR" && user.staffProfile?.isActive && user.staffProfile.id) {
    return user.staffProfile.id;
  }
  const view = await resolveViewContext(user);
  if (isActingAsDoctor(user, view.mode) && view.doctorStaffId) return view.doctorStaffId;
  if (user.role === "DOCTOR" && user.hospitalId) {
    return staffIdForAppUser(user.id, user.hospitalId);
  }
  return null;
}
