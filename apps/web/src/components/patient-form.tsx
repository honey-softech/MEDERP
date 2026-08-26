"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";
import { PhotoCapture } from "@/components/photo-capture";

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const ID_PROOFS = [
  { value: "", label: "None" },
  { value: "AADHAAR", label: "Aadhaar" },
  { value: "PAN", label: "PAN" },
  { value: "PASSPORT", label: "Passport" },
  { value: "DRIVING_LICENSE", label: "Driving licence" },
  { value: "VOTER_ID", label: "Voter ID" },
  { value: "OTHER", label: "Other" },
];

export type PatientFormValues = {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  bloodGroup: string;
  allergies: string;
  medicalHistory: string;
  familyHistory: string;
  socialHistory: string;
  currentMedications: string;
  emergencyName: string;
  emergencyPhone: string;
  idProofType: string;
  idProofNumber: string;
  insuranceProvider: string;
  insurancePolicyNo: string;
  insuranceValidUntil: string;
  photoData: string;
};

type Duplicate = {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  phone: string | null;
};

type FamilyHit = Duplicate & {
  familyGroupCode?: string | null;
};

export function PatientForm({
  initial,
  submitLabel,
  familyOfPatientId,
  familyRelationDefault = "CHILD",
  nextHref,
}: {
  initial?: PatientFormValues;
  submitLabel: string;
  familyOfPatientId?: string;
  familyRelationDefault?: string;
  nextHref?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [familyHits, setFamilyHits] = useState<FamilyHit[]>([]);
  const [familyOf, setFamilyOf] = useState(familyOfPatientId ?? "");
  const [familyRelation, setFamilyRelation] = useState(familyRelationDefault);
  const [values, setValues] = useState<PatientFormValues>(
    initial ?? {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "MALE",
      phone: "",
      email: "",
      address: "",
      bloodGroup: "",
      allergies: "",
      medicalHistory: "",
      familyHistory: "",
      socialHistory: "",
      currentMedications: "",
      emergencyName: "",
      emergencyPhone: "",
      idProofType: "",
      idProofNumber: "",
      insuranceProvider: "",
      insurancePolicyNo: "",
      insuranceValidUntil: "",
      photoData: "",
    },
  );

  function setField(field: keyof PatientFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  useEffect(() => {
    if (initial?.id || familyOfPatientId) return;
    const phone = values.phone.replace(/\D/g, "");
    if (phone.length < 8) {
      setFamilyHits([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/patients?phone=${encodeURIComponent(phone)}`);
      const raw = await response.text();
      let data: { patients?: FamilyHit[] } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { patients: [] };
      }
      setFamilyHits(data.patients ?? []);
      if (!familyOfPatientId && (data.patients ?? []).length > 0) {
        setFamilyOf((current) => current || data.patients![0].id);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [values.phone, initial?.id, familyOfPatientId]);

  async function submit(force = false, asFamilyId = familyOf) {
    setError("");
    setPending(true);
    const url = initial?.id ? `/api/patients/${initial.id}` : "/api/patients";
    const response = await fetch(url, {
      method: initial?.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        force,
        familyOfPatientId: asFamilyId || undefined,
        familyRelation: asFamilyId ? familyRelation : undefined,
      }),
    });
    const raw = await response.text();
    let data: { error?: string; duplicates?: Duplicate[]; patient?: { id: string } } = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: "Could not save patient. Please try again." };
    }
    setPending(false);

    if (response.status === 409 && data.duplicates) {
      setDuplicates(data.duplicates);
      setError(data.error ?? "");
      return;
    }
    if (!response.ok) {
      setError(data.error ?? "Could not save patient.");
      return;
    }

    const id = data.patient?.id ?? initial?.id;
    if (nextHref && id && !initial?.id) {
      const separator = nextHref.includes("?") ? "&" : "?";
      router.push(`${nextHref}${separator}patientId=${id}`);
    } else {
      router.push(id ? `/patients/${id}` : "/patients");
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit(false);
      }}
      className="grid max-w-5xl gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:grid-cols-2"
    >
      <PhotoCapture value={values.photoData} onChange={(value) => setField("photoData", value)} label="Patient photo" />

      <h3 className="md:col-span-2 font-semibold">Demographics</h3>
      <Field label="First name" value={values.firstName} onChange={(v) => setField("firstName", v)} required />
      <Field label="Last name" value={values.lastName} onChange={(v) => setField("lastName", v)} required />
      <Field label="Date of birth" type="date" value={values.dateOfBirth} onChange={(v) => setField("dateOfBirth", v)} required />
      <label className="text-sm font-medium text-slate-700">
        Gender
        <select className={fieldClass} value={values.gender} onChange={(event) => setField("gender", event.target.value)}>
          {GENDERS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <Field label="Blood group" value={values.bloodGroup} onChange={(v) => setField("bloodGroup", v)} placeholder="B+" />

      <h3 className="md:col-span-2 mt-2 font-semibold">Clinical history</h3>
      <Area label="Allergies" value={values.allergies} onChange={(v) => setField("allergies", v)} />
      <Area label="Medical history" value={values.medicalHistory} onChange={(v) => setField("medicalHistory", v)} />
      <Area label="Family history" value={values.familyHistory} onChange={(v) => setField("familyHistory", v)} />
      <Area label="Social history" value={values.socialHistory} onChange={(v) => setField("socialHistory", v)} />
      <Area
        label="Current medications"
        value={values.currentMedications}
        onChange={(v) => setField("currentMedications", v)}
        className="md:col-span-2"
      />

      <h3 className="md:col-span-2 mt-2 font-semibold">Contact</h3>
      <Field
        label="Phone (parent mobile is OK for children)"
        value={values.phone}
        onChange={(v) => setField("phone", v)}
      />
      <Field label="Email" type="email" value={values.email} onChange={(v) => setField("email", v)} />
      <label className="md:col-span-2 text-sm font-medium text-slate-700">
        Address
        <input className={fieldClass} value={values.address} onChange={(event) => setField("address", event.target.value)} />
      </label>
      <Field label="Emergency contact name" value={values.emergencyName} onChange={(v) => setField("emergencyName", v)} />
      <Field label="Emergency phone" value={values.emergencyPhone} onChange={(v) => setField("emergencyPhone", v)} />

      {!initial?.id && (familyHits.length > 0 || familyOf) ? (
        <div className="md:col-span-2 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm">
          <p className="font-medium text-teal-950">This mobile already has a hospital family group</p>
          <p className="mt-1 text-teal-800">
            Each person still gets a unique UHID. Add a child or dependent under the existing patient.
          </p>
          <ul className="mt-3 space-y-1">
            {familyHits.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2">
                <a className="text-teal-800 underline" href={`/patients/${row.id}`}>
                  {row.firstName} {row.lastName} · {row.mrn}
                </a>
                {row.familyGroupCode ? <span className="text-xs text-slate-500">{row.familyGroupCode}</span> : null}
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => setFamilyOf(row.id)}
                >
                  {familyOf === row.id ? "Selected as family head" : "Add under this patient"}
                </button>
              </li>
            ))}
          </ul>
          {familyOf ? (
            <label className="mt-3 block font-medium text-slate-700">
              Relation to family head
              <select className={fieldClass} value={familyRelation} onChange={(event) => setFamilyRelation(event.target.value)}>
                <option value="CHILD">Child</option>
                <option value="SPOUSE">Spouse</option>
                <option value="PARENT">Parent</option>
                <option value="SIBLING">Sibling</option>
                <option value="OTHER">Other dependent</option>
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <h3 className="md:col-span-2 mt-2 font-semibold">ID proof</h3>
      <label className="text-sm font-medium text-slate-700">
        ID type
        <select className={fieldClass} value={values.idProofType} onChange={(event) => setField("idProofType", event.target.value)}>
          {ID_PROOFS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <Field label="ID number" value={values.idProofNumber} onChange={(v) => setField("idProofNumber", v)} />

      <h3 className="md:col-span-2 mt-2 font-semibold">Insurance</h3>
      <Field label="Provider" value={values.insuranceProvider} onChange={(v) => setField("insuranceProvider", v)} />
      <Field label="Policy number" value={values.insurancePolicyNo} onChange={(v) => setField("insurancePolicyNo", v)} />
      <Field
        label="Valid until"
        type="date"
        value={values.insuranceValidUntil}
        onChange={(v) => setField("insuranceValidUntil", v)}
      />

      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      {duplicates.length > 0 ? (
        <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Possible existing records</p>
          <ul className="mt-2 space-y-1">
            {duplicates.map((row) => (
              <li key={row.id}>
                <a className="text-teal-800 underline" href={`/patients/${row.id}`}>
                  {row.firstName} {row.lastName} · {row.mrn}
                </a>
                {row.phone ? ` · ${row.phone}` : ""}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {duplicates[0] ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  setFamilyOf(duplicates[0].id);
                  void submit(true, duplicates[0].id);
                }}
                disabled={pending}
              >
                Add as family member
              </button>
            ) : null}
            <button type="button" className={secondaryButtonClass} onClick={() => void submit(true)} disabled={pending}>
              Register as a new independent patient
            </button>
          </div>
        </div>
      ) : null}
      <div className="md:col-span-2">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : familyOf && !initial?.id ? "Register in family group" : submitLabel}
        </button>
      </div>
    </form>
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
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        className={fieldClass}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`text-sm font-medium text-slate-700 ${className ?? ""}`}>
      {label}
      <textarea className={fieldClass} rows={2} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
