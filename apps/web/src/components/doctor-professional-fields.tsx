"use client";

import { fieldClass } from "@/components/auth-shell";

export type DoctorProfessionalValues = {
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
  yearsExperience?: string | null;
  areasOfExpertise?: string | null;
  languagesSpoken?: string | null;
  consultationType?: string | null;
  consultationFee?: string | null;
  followUpFee?: string | null;
  teleconsultEnabled?: boolean;
  emergencyDutyEnabled?: boolean;
};

export function DoctorProfessionalFields({
  values,
  onChange,
  requireCore = false,
}: {
  values: DoctorProfessionalValues;
  onChange: (key: keyof DoctorProfessionalValues, value: string | boolean) => void;
  requireCore?: boolean;
}) {
  return (
    <>
      <Field
        label="Medical registration number"
        value={values.medicalRegNo}
        onChange={(v) => onChange("medicalRegNo", v)}
        required={requireCore}
      />
      <Field label="Registration council" value={values.regCouncil} onChange={(v) => onChange("regCouncil", v)} />
      <Field label="Registration state / country" value={values.regRegion} onChange={(v) => onChange("regRegion", v)} />
      <Field label="Registration issue date" type="date" value={values.regIssuedAt} onChange={(v) => onChange("regIssuedAt", v)} />
      <Field label="Registration expiry date" type="date" value={values.regExpiresAt} onChange={(v) => onChange("regExpiresAt", v)} />
      <Field label="Medical degree" value={values.medicalDegree} onChange={(v) => onChange("medicalDegree", v)} placeholder="MBBS" />
      <Field label="University" value={values.university} onChange={(v) => onChange("university", v)} />
      <Field label="Graduation year" value={values.graduationYear} onChange={(v) => onChange("graduationYear", v)} />
      <Field
        label="Postgraduate qualification"
        value={values.postgraduate}
        onChange={(v) => onChange("postgraduate", v)}
        placeholder="MD – Cardiology"
      />
      <Field label="Fellowship" value={values.fellowship} onChange={(v) => onChange("fellowship", v)} />
      <Field
        label="Specialization"
        value={values.specialization}
        onChange={(v) => onChange("specialization", v)}
        required={requireCore}
      />
      <Field label="Sub-specialization" value={values.subSpecialization} onChange={(v) => onChange("subSpecialization", v)} />
      <Field label="Years of experience" value={values.yearsExperience} onChange={(v) => onChange("yearsExperience", v)} />
      <Field label="Areas of expertise" value={values.areasOfExpertise} onChange={(v) => onChange("areasOfExpertise", v)} />
      <Field label="Languages spoken" value={values.languagesSpoken} onChange={(v) => onChange("languagesSpoken", v)} />
      <Field
        label="Consultation type"
        value={values.consultationType}
        onChange={(v) => onChange("consultationType", v)}
        placeholder="OPD / Inpatient / Both"
      />
      <Field label="Consultation fee" value={values.consultationFee} onChange={(v) => onChange("consultationFee", v)} />
      <Field label="Follow-up fee" value={values.followUpFee} onChange={(v) => onChange("followUpFee", v)} />
      <Check
        label="Teleconsultation enabled"
        checked={Boolean(values.teleconsultEnabled)}
        onChange={(v) => onChange("teleconsultEnabled", v)}
      />
      <Check
        label="Emergency duty enabled"
        checked={Boolean(values.emergencyDutyEnabled)}
        onChange={(v) => onChange("emergencyDutyEnabled", v)}
      />
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
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
        onChange={(event) => onChange(event.target.value)}
      />
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
