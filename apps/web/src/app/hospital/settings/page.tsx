import { AppShell } from "@/components/app-shell";
import { AdminDoctorProfileForm } from "@/components/admin-doctor-profile-form";
import { HospitalBrandingForm } from "@/components/hospital-branding-form";
import { SignaturePolicyForm } from "@/components/signature-policy-form";
import { WalkInPolicyForm } from "@/components/walk-in-policy-form";
import { requireHospitalPage } from "@/lib/front-desk";
import { countStaffWithoutSignature } from "@/lib/signatures";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

function dateIso(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function decimalString(value: { toString(): string } | number | null | undefined) {
  if (value == null) return "";
  return String(value);
}

export default async function HospitalSettingsPage() {
  const user = await requireHospitalPage();
  if (user.role !== "SUPER_ADMIN") redirect("/");

  const [hospital, coverage, departments, staff, doctors] = await Promise.all([
    prisma.hospital.findUnique({
      where: { id: user.hospitalId },
      select: {
        name: true,
        code: true,
        address: true,
        phone: true,
        logoData: true,
        sealData: true,
        opdFee: true,
        requireSignatureForApproval: true,
        walkInByDoctor: true,
        walkInByNurse: true,
      },
    }),
    countStaffWithoutSignature(user.hospitalId),
    prisma.department.findMany({
      where: { hospitalId: user.hospitalId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.staff.findUnique({ where: { appUserId: user.id } }),
    prisma.staff.findMany({
      where: { hospitalId: user.hospitalId, role: "DOCTOR" },
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
        appUser: { select: { username: true, role: true } },
      },
    }),
  ]);
  if (!hospital) redirect("/");

  const doctorStaff = staff && staff.role === "DOCTOR" ? staff : null;

  return (
    <AppShell title="Hospital settings">
      <p className="mb-4 text-sm text-slate-500">
        Branding, admin-as-doctor, document policy, and who can add walk-ins. Changes are recorded in the
        audit log.
      </p>
      <div className="mb-6">
        <AdminDoctorProfileForm
          departments={departments.map((dept) => ({
            id: dept.id,
            label: `${dept.name} (${dept.code})`,
          }))}
          existingDoctors={doctors.map((row) => ({
            id: row.id,
            label: `${row.firstName} ${row.lastName}`.trim(),
            specialization: row.specialization ?? "",
            medicalRegNo: row.medicalRegNo ?? "",
            department: row.department ? `${row.department.name} (${row.department.code})` : "",
            isActive: row.isActive,
            linkedToAdmin: row.appUserId === user.id,
            linkedUsername: row.appUser?.username ?? null,
            linkedRole: row.appUser?.role ?? null,
          }))}
          initialEnabled={Boolean(doctorStaff?.isActive)}
          initialLinkedStaffId={doctorStaff?.id ?? null}
          initialProfile={
            doctorStaff
              ? {
                  departmentId: doctorStaff.departmentId ?? "",
                  opdRoom: doctorStaff.opdRoom ?? "",
                  shift: doctorStaff.shift ?? "",
                  weeklySchedule: doctorStaff.weeklySchedule ?? "",
                  medicalRegNo: doctorStaff.medicalRegNo ?? "",
                  regCouncil: doctorStaff.regCouncil ?? "",
                  regRegion: doctorStaff.regRegion ?? "",
                  regIssuedAt: dateIso(doctorStaff.regIssuedAt),
                  regExpiresAt: dateIso(doctorStaff.regExpiresAt),
                  medicalDegree: doctorStaff.medicalDegree ?? "",
                  university: doctorStaff.university ?? "",
                  graduationYear:
                    doctorStaff.graduationYear != null ? String(doctorStaff.graduationYear) : "",
                  postgraduate: doctorStaff.postgraduate ?? "",
                  fellowship: doctorStaff.fellowship ?? "",
                  specialization: doctorStaff.specialization ?? "",
                  subSpecialization: doctorStaff.subSpecialization ?? "",
                  yearsExperience:
                    doctorStaff.yearsExperience != null ? String(doctorStaff.yearsExperience) : "",
                  areasOfExpertise: doctorStaff.areasOfExpertise ?? "",
                  languagesSpoken: doctorStaff.languagesSpoken ?? "",
                  consultationType: doctorStaff.consultationType ?? "",
                  consultationFee: decimalString(doctorStaff.consultationFee),
                  followUpFee: decimalString(doctorStaff.followUpFee),
                  teleconsultEnabled: doctorStaff.teleconsultEnabled,
                  emergencyDutyEnabled: doctorStaff.emergencyDutyEnabled,
                  firstName: doctorStaff.firstName,
                  lastName: doctorStaff.lastName,
                }
              : null
          }
          user={{
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
            mobile: user.mobile,
            email: user.email ?? "",
          }}
        />
      </div>
      <HospitalBrandingForm
        initial={{
          name: hospital.name,
          code: hospital.code,
          address: hospital.address ?? "",
          phone: hospital.phone ?? "",
          logoData: hospital.logoData ?? "",
          sealData: hospital.sealData ?? "",
          opdFee: String(Number(hospital.opdFee ?? 500)),
        }}
      />
      <SignaturePolicyForm
        initial={{ requireSignatureForApproval: hospital.requireSignatureForApproval }}
        coverage={coverage}
      />
      <WalkInPolicyForm
        initial={{
          walkInByDoctor: hospital.walkInByDoctor,
          walkInByNurse: hospital.walkInByNurse,
        }}
      />
    </AppShell>
  );
}
