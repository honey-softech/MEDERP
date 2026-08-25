"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth-shell";

type DepartmentOption = { id: string; label: string };

type CapacityField = {
  code: string;
  label: string;
  total: number;
};

export function WardCapacityForm({ fields }: { fields: CapacityField[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const counts: Record<string, number> = {};
    for (const field of fields) {
      counts[field.code] = Number(form.get(field.code) ?? 0);
    }
    const response = await fetch("/api/wards/capacity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(counts),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not update capacity.");
      return;
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-8 grid gap-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-4 shadow-sm sm:p-6 md:grid-cols-2 lg:grid-cols-3"
    >
      <div className="md:col-span-2 lg:col-span-3">
        <h3 className="font-semibold text-slate-900">Hospital room / bed capacity</h3>
        <p className="mt-1 text-sm text-slate-600">
          Set how many private, semi-private, general male, general female, and ICU beds this hospital has.
          Private and semi-private counts are one bed per room. Reception uses these when admitting patients.
        </p>
      </div>
      {fields.map((field) => (
        <label key={field.code} className="text-sm font-medium text-slate-700">
          {field.label}
          <input
            className={fieldClass}
            name={field.code}
            type="number"
            min={0}
            max={80}
            defaultValue={field.total}
            required
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Currently {field.total} active
          </span>
        </label>
      ))}
      {error ? <p className="md:col-span-2 lg:col-span-3 text-sm text-red-600">{error}</p> : null}
      <div className="md:col-span-2 lg:col-span-3">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save capacity"}
        </button>
      </div>
    </form>
  );
}

export function WardCreateForm({ departments }: { departments: DepartmentOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = event.currentTarget;
    const response = await fetch("/api/wards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not create the ward.");
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:grid-cols-2">
      <h3 className="md:col-span-2 font-semibold">Add ward</h3>
      <label className="text-sm font-medium text-slate-700">
        Name
        <input className={fieldClass} name="name" required placeholder="General Male" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Code
        <input className={fieldClass} name="code" required placeholder="GM" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Department
        <select className={fieldClass} name="departmentId" required>
          <option value="">Select department</option>
          {departments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Type
        <select className={fieldClass} name="type" defaultValue="GENERAL">
          <option value="GENERAL">General</option>
          <option value="PRIVATE">Private</option>
          <option value="SEMI_PRIVATE">Semi private</option>
          <option value="ICU">ICU</option>
          <option value="ICCU">ICCU</option>
          <option value="NICU">NICU</option>
          <option value="PICU">PICU</option>
          <option value="ISOLATION">Isolation</option>
          <option value="LABOUR">Labour</option>
          <option value="DAY_CARE">Day care</option>
          <option value="CASUALTY">Casualty observation</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Gender policy
        <select className={fieldClass} name="genderPolicy" defaultValue="MIXED">
          <option value="MIXED">Mixed</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="PAEDIATRIC">Paediatric</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Floor / block
        <input className={fieldClass} name="floor" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Daily bed rate
        <input className={fieldClass} name="dailyRate" type="number" min="0" step="0.01" defaultValue="1500" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Daily nursing rate
        <input className={fieldClass} name="nursingRate" type="number" min="0" step="0.01" defaultValue="300" />
      </label>
      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      <div className="md:col-span-2">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create ward"}
        </button>
      </div>
    </form>
  );
}

export function AddBedsForm({ wardId, prefix }: { wardId: string; prefix: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/wards/${wardId}/beds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        count: Number(form.get("count")),
        prefix: form.get("prefix"),
        type: form.get("type"),
        room: form.get("room"),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not add beds.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-4">
      <label className="text-sm font-medium text-slate-700">
        How many
        <input className={fieldClass} name="count" type="number" min="1" max="40" defaultValue="1" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Prefix
        <input className={fieldClass} name="prefix" defaultValue={prefix} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Type
        <select className={fieldClass} name="type" defaultValue="GENERAL">
          <option value="GENERAL">General</option>
          <option value="PRIVATE">Private</option>
          <option value="SEMI_PRIVATE">Semi private</option>
          <option value="ICU">ICU</option>
          <option value="VENTILATOR">Ventilator</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Room
        <input className={fieldClass} name="room" placeholder="Optional" />
      </label>
      {error ? <p className="sm:col-span-4 text-sm text-red-600">{error}</p> : null}
      <div className="sm:col-span-4">
        <button className={secondaryButtonClass} type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add beds"}
        </button>
      </div>
    </form>
  );
}

export function WardRatesForm({
  wardId,
  dailyRate,
  nursingRate,
  isActive,
}: {
  wardId: string;
  dailyRate: number;
  nursingRate: number;
  isActive: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/wards/${wardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dailyRate: Number(form.get("dailyRate")),
        nursingRate: Number(form.get("nursingRate")),
        isActive: form.get("isActive") === "on",
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not update the ward.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-4">
      <label className="text-sm font-medium text-slate-700">
        Daily bed rate
        <input className={fieldClass} name="dailyRate" type="number" min="0" step="0.01" defaultValue={dailyRate} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Daily nursing rate
        <input className={fieldClass} name="nursingRate" type="number" min="0" step="0.01" defaultValue={nursingRate} />
      </label>
      <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-700">
        <input type="checkbox" name="isActive" defaultChecked={isActive} />
        Active
      </label>
      <div className="flex items-end">
        <button className={secondaryButtonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save rates"}
        </button>
      </div>
      {error ? <p className="sm:col-span-4 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
