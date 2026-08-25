"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fieldClass } from "@/components/auth-shell";

export type PatientOption = {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  phone: string | null;
};

export function PatientPicker({
  name = "patientId",
  label = "Patient",
  required = true,
  initial,
  registerHref,
}: {
  name?: string;
  label?: string;
  required?: boolean;
  initial?: PatientOption | null;
  registerHref?: string;
}) {
  const [query, setQuery] = useState(
    initial ? `${initial.firstName} ${initial.lastName} · ${initial.mrn}` : "",
  );
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [results, setResults] = useState<PatientOption[]>([]);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || selectedId) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearched(false);
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/patients?q=${encodeURIComponent(q)}`);
      const raw = await response.text();
      let data: { patients?: PatientOption[] } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { patients: [] };
      }
      setResults(data.patients ?? []);
      setSearched(true);
      setOpen(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, selectedId]);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-700">
        {label}
        <input type="hidden" name={name} value={selectedId} required={required} />
        <input
          className={fieldClass}
          value={query}
          placeholder="Search name, phone, or UHID"
          autoComplete="off"
          onChange={(event) => {
            setSelectedId("");
            setQuery(event.target.value);
          }}
          onFocus={() => (results.length > 0 || searched) && setOpen(true)}
        />
      </label>
      {open && results.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-teal-50"
                onClick={() => {
                  setSelectedId(patient.id);
                  setQuery(`${patient.firstName} ${patient.lastName} · ${patient.mrn}`);
                  setOpen(false);
                }}
              >
                <span className="font-medium">
                  {patient.firstName} {patient.lastName}
                </span>
                <span className="ml-2 font-mono text-xs text-slate-500">{patient.mrn}</span>
                {patient.phone ? <span className="ml-2 text-slate-500">{patient.phone}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && searched && results.length === 0 && !selectedId ? (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600 shadow-lg">
          No matching patient. Register them, then continue booking.
          {registerHref ? (
            <Link href={registerHref} className="mt-2 block font-medium text-teal-700 hover:underline">
              Register new patient
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
