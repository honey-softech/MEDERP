"use client";

import Link from "next/link";
import { useState } from "react";
import { ExpandToggle } from "@/components/expand-toggle";

export function PatientFamilyGroup({
  members,
  currentPatientId,
  canEdit,
  children,
}: {
  members: { id: string; name: string; mrn: string }[];
  currentPatientId: string;
  canEdit: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-8 max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">Family group</h3>
          <p className="mt-1 text-sm text-slate-500">
            Children can share a parent&apos;s mobile. Each member has a unique UHID. Expand this
            section to register another patient under the same family.
          </p>
        </div>
        {canEdit ? (
          <ExpandToggle
            open={open}
            onToggle={() => setOpen((current) => !current)}
            labelClosed="Add family member"
            labelOpen="Collapse"
          />
        ) : null}
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {members.map((member) => (
          <li key={member.id}>
            <Link className="text-teal-700 hover:underline" href={`/patients/${member.id}`}>
              {member.name}
            </Link>
            <span className="font-mono text-slate-500"> · {member.mrn}</span>
            {member.id === currentPatientId ? <span className="text-teal-700"> · this patient</span> : null}
          </li>
        ))}
      </ul>
      {open && canEdit ? <div className="mt-4 border-t border-slate-100 pt-4">{children}</div> : null}
    </section>
  );
}
