"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass } from "@/components/auth-shell";
import { ExpandToggle } from "@/components/expand-toggle";
import { PhotoCapture } from "@/components/photo-capture";
import { suggestedUsername } from "@/lib/usernames";

const roles = [
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "DOCTOR", label: "Doctor" },
  { value: "NURSE", label: "Nurse" },
  { value: "PHARMACIST", label: "Pharmacist" },
  { value: "LAB_TECH", label: "Lab technician" },
  { value: "ACCOUNTANT", label: "Accountant" },
];

const employmentTypes = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "CONSULTANT", label: "Consultant" },
  { value: "TEMPORARY", label: "Temporary" },
  { value: "INTERN", label: "Intern" },
];

export type HospitalUserFormInitial = {
  id?: string;
  userCode?: string | null;
  role: string;
  employeeId?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  photoData?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  mobile?: string | null;
  email?: string | null;
  username?: string | null;
  isActive?: boolean;
  isVerified?: boolean;
  dateJoined?: string | null;
  employmentType?: string | null;
  preferredLanguage?: string | null;
  timezone?: string | null;
  departmentId?: string | null;
  subDepartment?: string | null;
  designation?: string | null;
  jobTitle?: string | null;
  employmentStatus?: string | null;
  reportingManager?: string | null;
  workLocation?: string | null;
  branchName?: string | null;
  floor?: string | null;
  assignedWard?: string | null;
  assignedUnit?: string | null;
  opdRoom?: string | null;
  procedureRoom?: string | null;
  shift?: string | null;
  weeklySchedule?: string | null;
  joiningDate?: string | null;
  probationEndAt?: string | null;
  yearsExperience?: string | null;
  consultationFee?: string | null;
  followUpFee?: string | null;
  consultationType?: string | null;
  teleconsultEnabled?: boolean;
  emergencyDutyEnabled?: boolean;
  medicalRegNo?: string | null;
  regCouncil?: string | null;
  regRegion?: string | null;
  regIssuedAt?: string | null;
  regExpiresAt?: string | null;
  medicalDegree?: string | null;
  university?: string | null;
  graduationYear?: string | null;
  postgraduate?: string | null;
  fellowship?: string | null;
  specialization?: string | null;
  subSpecialization?: string | null;
  areasOfExpertise?: string | null;
  languagesSpoken?: string | null;
  nursingRegNo?: string | null;
  nursingCouncil?: string | null;
  nursingQualification?: string | null;
  nursingSpecialization?: string | null;
  nursingGrade?: string | null;
  nurseInCharge?: boolean;
  emergencyDutyEligible?: boolean;
  pharmacyRegNo?: string | null;
  pharmacyCouncil?: string | null;
  pharmacyQualification?: string | null;
  licenseExpiresAt?: string | null;
  labCertification?: string | null;
  labQualification?: string | null;
  labLicenseNo?: string | null;
  labDepartment?: string | null;
  authorizedTestCategories?: string | null;
  modalities?: string | null;
};

const empty: HospitalUserFormInitial = { role: "RECEPTIONIST" };

export default function HospitalUserForm({
  initial,
  departments = [],
  plain = false,
  onCreated,
  onSaved,
  createUrl = "/api/hospital/users",
  updateUrl,
  returnHref = "/hospital/users",
  allowSuperAdminRole = false,
  hospitalId,
}: {
  initial?: HospitalUserFormInitial;
  departments?: { id: string; label: string }[];
  plain?: boolean;
  onCreated?: (generatedPassword?: string) => void;
  onSaved?: () => void;
  createUrl?: string;
  updateUrl?: string;
  returnHref?: string | null;
  allowSuperAdminRole?: boolean;
  hospitalId?: string;
}) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const roleLocked = initial?.role === "SUPER_ADMIN" && !allowSuperAdminRole;
  const roleOptions = allowSuperAdminRole
    ? [{ value: "SUPER_ADMIN", label: "Hospital super admin" }, ...roles]
    : roles;
  const [values, setValues] = useState<HospitalUserFormInitial>({
    ...empty,
    ...initial,
    role:
      initial?.role && initial.role !== "SOFTWARE_ADMIN" && initial.role !== "HELPDESK"
        ? initial.role
        : "RECEPTIONIST",
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [employmentOpen, setEmploymentOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [professionalOpen, setProfessionalOpen] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(editing);

  const role = roleLocked ? "SUPER_ADMIN" : values.role ?? "RECEPTIONIST";

  function setField<K extends keyof HospitalUserFormInitial>(key: K, value: HospitalUserFormInitial[K]) {
    if (key === "username") setUsernameTouched(true);
    setValues((current) => {
      const next = { ...current, [key]: value };
      const nextRole = key === "role" ? String(value) : roleLocked ? "SUPER_ADMIN" : next.role ?? "RECEPTIONIST";
      if (!usernameTouched && (key === "firstName" || key === "lastName" || key === "role")) {
        next.username = suggestedUsername(next.firstName ?? "", next.lastName ?? "", nextRole);
      }
      return next;
    });
  }

  const payload = useMemo(
    () => ({ ...values, role, password: password || undefined, ...(hospitalId ? { hospitalId } : {}) }),
    [values, role, password, hospitalId],
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setGeneratedPassword("");
    setPending(true);
    const url = editing ? updateUrl || `/api/hospital/users/${initial!.id}` : createUrl;
    const response = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const raw = await response.text();
    let data: { error?: string; generatedPassword?: string } = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: "Could not save user. Please try again." };
    }
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save user.");
      return;
    }
    if (data.generatedPassword) {
      setGeneratedPassword(data.generatedPassword);
    }
    if (editing) {
      onSaved?.();
      router.refresh();
      if (returnHref) router.push(returnHref);
      return;
    }
    setValues({ ...empty, role: "RECEPTIONIST" });
    setPassword("");
    router.refresh();
    onCreated?.(data.generatedPassword);
    onSaved?.();
  }

  return (
    <form
      onSubmit={onSubmit}
      className={
        plain
          ? "grid gap-4 md:grid-cols-2"
          : "grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:grid-cols-2"
      }
    >
      {plain ? null : (
        <div className="md:col-span-2">
          <h3 className="font-semibold">{editing ? "Edit hospital user" : "Add hospital user"}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Employee ID is assigned from the hospital code in registration order (HSP-0001, HSP-0002, …). User ID is a separate hospital-unique code mapped to this record. Both are assigned on save.
          </p>
        </div>
      )}

      <p className="md:col-span-2 text-sm text-slate-500">
        Name, mobile number, and password are required. Expand a section only if you need those extra details.
      </p>
      <Select
        label="Role"
        value={roleLocked ? "SUPER_ADMIN" : role}
        disabled={roleLocked}
        required
        onChange={(value) => setField("role", value)}
        options={roleLocked ? [{ value: "SUPER_ADMIN", label: "Hospital super admin" }] : roleOptions}
      />
      {editing && values.employeeId ? (
        <Field label="Employee ID" value={values.employeeId} onChange={() => undefined} disabled />
      ) : (
        <p className="self-end text-sm text-slate-500">Employee ID is assigned on save from the hospital code (e.g. HSP-0001).</p>
      )}
      {editing && values.userCode ? (
        <Field label="User ID" value={values.userCode} onChange={() => undefined} disabled />
      ) : (
        <p className="self-end text-sm text-slate-500">User ID is assigned on save (DOC-000001, NUR-000001, …) and stays unique to this hospital.</p>
      )}

      <Field label="First name" value={values.firstName} onChange={(v) => setField("firstName", v)} required autoComplete="given-name" />
      <Field label="Last name" value={values.lastName} onChange={(v) => setField("lastName", v)} autoComplete="family-name" />
      <Field
        label="Username"
        value={values.username}
        onChange={(v) => setField("username", v)}
        placeholder="Auto from first name, last name, and role"
        autoComplete={editing ? "username" : "off"}
      />
      <Field label="Mobile number" value={values.mobile} onChange={(v) => setField("mobile", v)} required placeholder="+91 XXXXX XXXXX" autoComplete="tel" />
      <Field
        label={editing ? "New password (optional)" : "Password"}
        type="password"
        value={password}
        onChange={setPassword}
        required={!editing}
        minLength={8}
        placeholder={editing ? "Leave blank to keep the current password" : "At least 8 characters"}
        autoComplete="new-password"
      />

      <FormSection
        title="Account details"
        open={accountOpen}
        onToggle={() => setAccountOpen((open) => !open)}
        hint="Photo, email, and login extras"
      >
        <div className="md:col-span-2">
          <PhotoCapture value={values.photoData ?? ""} onChange={(value) => setField("photoData", value)} label="Profile photo" />
        </div>
        <Field label="Middle name" value={values.middleName} onChange={(v) => setField("middleName", v)} autoComplete="additional-name" />
        <Field label="Date of birth" type="date" value={values.dateOfBirth} onChange={(v) => setField("dateOfBirth", v)} />
        <Select
          label="Gender"
          value={values.gender ?? ""}
          onChange={(v) => setField("gender", v)}
          options={[
            { value: "", label: "Select" },
            { value: "MALE", label: "Male" },
            { value: "FEMALE", label: "Female" },
            { value: "OTHER", label: "Other" },
          ]}
        />
        <Field label="Email" type="email" value={values.email} onChange={(v) => setField("email", v)} placeholder="Optional" autoComplete="email" />
        <Select
          label="Account status"
          value={values.isActive === false ? "INACTIVE" : "ACTIVE"}
          onChange={(v) => setField("isActive", v === "ACTIVE")}
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
        <Field label="Date joined" type="date" value={values.dateJoined} onChange={(v) => setField("dateJoined", v)} />
        <Select
          label="Employment type"
          value={values.employmentType ?? "FULL_TIME"}
          onChange={(v) => setField("employmentType", v)}
          options={employmentTypes}
        />
        <Field label="Preferred language" value={values.preferredLanguage ?? "English"} onChange={(v) => setField("preferredLanguage", v)} />
        <Field label="Time zone" value={values.timezone ?? "Asia/Kolkata"} onChange={(v) => setField("timezone", v)} />
        {editing ? (
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={values.isVerified !== false} onChange={(event) => setField("isVerified", event.target.checked)} />
            Verified (can sign in)
          </label>
        ) : null}
      </FormSection>

      <FormSection
        title="Employment"
        open={employmentOpen}
        onToggle={() => setEmploymentOpen((open) => !open)}
        hint="Department, designation, and joining dates"
      >
        <Select
          label="Department"
          value={values.departmentId ?? ""}
          onChange={(v) => setField("departmentId", v)}
          options={[{ value: "", label: "Select department" }, ...departments.map((row) => ({ value: row.id, label: row.label }))]}
        />
        <Field label="Sub-department" value={values.subDepartment} onChange={(v) => setField("subDepartment", v)} />
        <Field label="Designation" value={values.designation} onChange={(v) => setField("designation", v)} placeholder="Senior Consultant" />
        <Field label="Job title" value={values.jobTitle} onChange={(v) => setField("jobTitle", v)} />
        <Select
          label="Employment status"
          value={values.employmentStatus ?? "ACTIVE"}
          onChange={(v) => setField("employmentStatus", v)}
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "PROBATION", label: "Probation" },
            { value: "ON_LEAVE", label: "On leave" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
        <Field label="Joining date" type="date" value={values.joiningDate} onChange={(v) => setField("joiningDate", v)} />
        <Field label="Probation end date" type="date" value={values.probationEndAt} onChange={(v) => setField("probationEndAt", v)} />
        <Field label="Reporting manager" value={values.reportingManager} onChange={(v) => setField("reportingManager", v)} />
      </FormSection>

      <FormSection
        title="Department and location"
        open={locationOpen}
        onToggle={() => setLocationOpen((open) => !open)}
        hint="Branch, ward, room, and shift"
      >
        <Field label="Hospital / branch" value={values.branchName} onChange={(v) => setField("branchName", v)} />
        <Field label="Work location" value={values.workLocation} onChange={(v) => setField("workLocation", v)} />
        <Field label="Floor" value={values.floor} onChange={(v) => setField("floor", v)} />
        <Field label="Assigned ward / unit" value={values.assignedWard} onChange={(v) => setField("assignedWard", v)} />
        <Field label="Unit" value={values.assignedUnit} onChange={(v) => setField("assignedUnit", v)} />
        <Field label="OPD room" value={values.opdRoom} onChange={(v) => setField("opdRoom", v)} />
        <Field label="Procedure room" value={values.procedureRoom} onChange={(v) => setField("procedureRoom", v)} />
        <Field label="Shift" value={values.shift} onChange={(v) => setField("shift", v)} />
        <Field label="Weekly working schedule" value={values.weeklySchedule} onChange={(v) => setField("weeklySchedule", v)} placeholder="Mon–Sat 9:00–17:00" />
      </FormSection>

      {role === "DOCTOR" ? (
        <FormSection
          title="Doctor professional information"
          open={professionalOpen}
          onToggle={() => setProfessionalOpen((open) => !open)}
          hint="Registration, fees, and qualifications"
        >
          <Field label="Medical registration number" value={values.medicalRegNo} onChange={(v) => setField("medicalRegNo", v)} />
          <Field label="Registration council" value={values.regCouncil} onChange={(v) => setField("regCouncil", v)} />
          <Field label="Registration state / country" value={values.regRegion} onChange={(v) => setField("regRegion", v)} />
          <Field label="Registration issue date" type="date" value={values.regIssuedAt} onChange={(v) => setField("regIssuedAt", v)} />
          <Field label="Registration expiry date" type="date" value={values.regExpiresAt} onChange={(v) => setField("regExpiresAt", v)} />
          <Field label="Medical degree" value={values.medicalDegree} onChange={(v) => setField("medicalDegree", v)} placeholder="MBBS" />
          <Field label="University" value={values.university} onChange={(v) => setField("university", v)} />
          <Field label="Graduation year" value={values.graduationYear} onChange={(v) => setField("graduationYear", v)} />
          <Field label="Postgraduate qualification" value={values.postgraduate} onChange={(v) => setField("postgraduate", v)} placeholder="MD – Cardiology" />
          <Field label="Fellowship" value={values.fellowship} onChange={(v) => setField("fellowship", v)} />
          <Field label="Specialization" value={values.specialization} onChange={(v) => setField("specialization", v)} />
          <Field label="Sub-specialization" value={values.subSpecialization} onChange={(v) => setField("subSpecialization", v)} />
          <Field label="Years of experience" value={values.yearsExperience} onChange={(v) => setField("yearsExperience", v)} />
          <Field label="Areas of expertise" value={values.areasOfExpertise} onChange={(v) => setField("areasOfExpertise", v)} />
          <Field label="Languages spoken" value={values.languagesSpoken} onChange={(v) => setField("languagesSpoken", v)} />
          <Field label="Consultation type" value={values.consultationType} onChange={(v) => setField("consultationType", v)} placeholder="OPD / Inpatient / Both" />
          <Field label="Consultation fee" value={values.consultationFee} onChange={(v) => setField("consultationFee", v)} />
          <Field label="Follow-up fee" value={values.followUpFee} onChange={(v) => setField("followUpFee", v)} />
          <Check label="Teleconsultation enabled" checked={Boolean(values.teleconsultEnabled)} onChange={(v) => setField("teleconsultEnabled", v)} />
          <Check label="Emergency duty enabled" checked={Boolean(values.emergencyDutyEnabled)} onChange={(v) => setField("emergencyDutyEnabled", v)} />
        </FormSection>
      ) : null}

      {role === "NURSE" ? (
        <FormSection
          title="Nursing information"
          open={professionalOpen}
          onToggle={() => setProfessionalOpen((open) => !open)}
          hint="Registration, grade, and duty details"
        >
          <Field label="Nursing registration number" value={values.nursingRegNo} onChange={(v) => setField("nursingRegNo", v)} />
          <Field label="Registration council" value={values.nursingCouncil} onChange={(v) => setField("nursingCouncil", v)} />
          <Field label="Nursing qualification" value={values.nursingQualification} onChange={(v) => setField("nursingQualification", v)} placeholder="BSc Nursing / GNM" />
          <Field label="Specialization" value={values.nursingSpecialization} onChange={(v) => setField("nursingSpecialization", v)} />
          <Field label="Years of experience" value={values.yearsExperience} onChange={(v) => setField("yearsExperience", v)} />
          <Field label="Nursing grade" value={values.nursingGrade} onChange={(v) => setField("nursingGrade", v)} />
          <Field label="Assigned ward" value={values.assignedWard} onChange={(v) => setField("assignedWard", v)} />
          <Field label="Assigned department" value={values.subDepartment} onChange={(v) => setField("subDepartment", v)} />
          <Field label="Shift" value={values.shift} onChange={(v) => setField("shift", v)} />
          <Check label="Nurse-in-charge" checked={Boolean(values.nurseInCharge)} onChange={(v) => setField("nurseInCharge", v)} />
          <Check label="Emergency duty eligible" checked={Boolean(values.emergencyDutyEligible)} onChange={(v) => setField("emergencyDutyEligible", v)} />
        </FormSection>
      ) : null}

      {role === "PHARMACIST" ? (
        <FormSection
          title="Pharmacist information"
          open={professionalOpen}
          onToggle={() => setProfessionalOpen((open) => !open)}
          hint="License and pharmacy assignment"
        >
          <Field label="Pharmacy registration number" value={values.pharmacyRegNo} onChange={(v) => setField("pharmacyRegNo", v)} />
          <Field label="Pharmacy council" value={values.pharmacyCouncil} onChange={(v) => setField("pharmacyCouncil", v)} />
          <Field label="Qualification" value={values.pharmacyQualification} onChange={(v) => setField("pharmacyQualification", v)} />
          <Field label="Specialization" value={values.specialization} onChange={(v) => setField("specialization", v)} />
          <Field label="License expiry" type="date" value={values.licenseExpiresAt} onChange={(v) => setField("licenseExpiresAt", v)} />
          <Field label="Pharmacy / branch assignment" value={values.branchName} onChange={(v) => setField("branchName", v)} />
        </FormSection>
      ) : null}

      {role === "LAB_TECH" ? (
        <FormSection
          title="Lab / radiology technician"
          open={professionalOpen}
          onToggle={() => setProfessionalOpen((open) => !open)}
          hint="Certification and authorized tests"
        >
          <Field label="Certification" value={values.labCertification} onChange={(v) => setField("labCertification", v)} />
          <Field label="Qualification" value={values.labQualification} onChange={(v) => setField("labQualification", v)} />
          <Field label="Registration / license" value={values.labLicenseNo} onChange={(v) => setField("labLicenseNo", v)} />
          <Field label="Laboratory department" value={values.labDepartment} onChange={(v) => setField("labDepartment", v)} />
          <Field label="Authorized test categories" value={values.authorizedTestCategories} onChange={(v) => setField("authorizedTestCategories", v)} />
          <Field label="Modality authorization" value={values.modalities} onChange={(v) => setField("modalities", v)} placeholder="X-ray, CT, MRI, Ultrasound" />
        </FormSection>
      ) : null}

      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      {generatedPassword ? (
        <p className="md:col-span-2 rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900">
          User saved. Generated password: <span className="font-mono font-semibold">{generatedPassword}</span> — share it with the staff member now.
        </p>
      ) : null}
      <div className="md:col-span-2">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save user" : "Save and create user"}
        </button>
      </div>
    </form>
  );
}

function FormSection({
  title,
  open,
  onToggle,
  hint,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="md:col-span-2 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <h4 className="font-semibold">{title}</h4>
          {!open && hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
        </div>
        <ExpandToggle open={open} onToggle={onToggle} />
      </div>
      {open ? <div className="grid gap-4 border-t border-slate-200 p-3 md:grid-cols-2">{children}</div> : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  disabled,
  autoComplete,
  minLength,
}: {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
      <input
        className={fieldClass}
        type={type}
        value={value ?? ""}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  disabled,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
      <select className={fieldClass} value={value} disabled={disabled} required={required} onChange={(event) => onChange(event.target.value)}>
        {options.map((item) => (
          <option key={item.value || "empty"} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
