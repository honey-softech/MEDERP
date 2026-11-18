"use client";

import { fieldClass, secondaryButtonClass, textareaClass } from "@/components/auth-shell";
import { PhotoCapture } from "@/components/photo-capture";
import { SaveBar } from "@/components/settings/save-bar";
import { useSettingsForm } from "@/components/settings/use-settings-form";
import type { ExtraPhone, ExtraPhoneKind } from "@/lib/hospital-letterhead";

type BrandingValues = {
  name: string;
  code: string;
  address: string;
  phone: string;
  extraPhones: ExtraPhone[];
  logoData: string;
  sealData: string;
  opdFee: string;
};

export function HospitalBrandingForm({ initial }: { initial: BrandingValues }) {
  const form = useSettingsForm(initial);
  const { address, phone, extraPhones, opdFee, logoData, sealData } = form.values;

  function save() {
    void form.save(
      {
        address,
        phone,
        altPhones: extraPhones,
        logoData,
        sealData,
        opdFee: Number(opdFee),
      },
      "Could not save hospital profile.",
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (form.dirty) save();
      }}
      className="mt-4 grid gap-4 md:grid-cols-2"
    >
      <p className="text-sm text-text-secondary md:col-span-2">
        Printed at the top of bills, visit summaries, investigation lists, and certificates.
      </p>
      <p className="text-sm font-medium text-slate-700">
        Hospital
        <span className={`${fieldClass} mt-1 block bg-slate-50`}>{initial.name} · {initial.code}</span>
      </p>
      <label className="text-sm font-medium text-slate-700">
        Mobile
        <input className={fieldClass} value={phone} onChange={(event) => form.patch({ phone: event.target.value })} placeholder="+91 ..." />
      </label>
      <div className="md:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">Landline and other numbers</p>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => form.patch({ extraPhones: [...extraPhones, { kind: "landline", number: "" }] })}
          >
            Add number
          </button>
        </div>
        <p className="mt-1 text-sm font-normal text-slate-500">
          Each number is printed on its own line under the clinic name. Add every landline the desk answers.
        </p>
        {extraPhones.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No extra numbers yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {extraPhones.map((row, index) => (
              <li key={`${row.kind}-${index}`} className="flex flex-wrap items-center gap-2">
                <select
                  className={`${fieldClass} w-36`}
                  value={row.kind}
                  aria-label={`Number ${index + 1} type`}
                  onChange={(event) => {
                    const kind = event.target.value as ExtraPhoneKind;
                    form.patch({
                      extraPhones: extraPhones.map((item, itemIndex) => (itemIndex === index ? { ...item, kind } : item)),
                    });
                  }}
                >
                  <option value="landline">Landline</option>
                  <option value="mobile">Mobile</option>
                  <option value="other">Other</option>
                </select>
                <input
                  className={`${fieldClass} min-w-[12rem] flex-1`}
                  value={row.number}
                  aria-label={`Number ${index + 1}`}
                  placeholder="044 2468 1234"
                  onChange={(event) => {
                    const number = event.target.value;
                    form.patch({
                      extraPhones: extraPhones.map((item, itemIndex) => (itemIndex === index ? { ...item, number } : item)),
                    });
                  }}
                />
                <button
                  type="button"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900"
                  onClick={() => form.patch({ extraPhones: extraPhones.filter((_, itemIndex) => itemIndex !== index) })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <label className="md:col-span-2 text-sm font-medium text-slate-700">
        Address
        <textarea
          className={textareaClass}
          rows={3}
          value={address}
          onChange={(event) => form.patch({ address: event.target.value })}
          placeholder="Street, area, city, PIN"
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Default OPD amount (₹)
        <input
          className={fieldClass}
          type="number"
          min="0"
          step="0.01"
          value={opdFee}
          onChange={(event) => form.patch({ opdFee: event.target.value })}
        />
        <span className="mt-1 block font-normal text-slate-500">
          Used on the OPD queue payment screen. Reception can still enter a different amount for a visit. Default is 500.
        </span>
      </label>
      <div className="md:col-span-2">
        <PhotoCapture
          variant="logo"
          value={logoData}
          onChange={(logoData) => form.patch({ logoData })}
          label="Hospital logo (right side of print header)"
        />
      </div>
      <div className="md:col-span-2">
        <PhotoCapture
          variant="logo"
          value={sealData}
          onChange={(sealData) => form.patch({ sealData })}
          label="Accreditation / seal icon (left side of print header, optional)"
        />
      </div>
      <div className="md:col-span-2">
        <SaveBar
          dirty={form.dirty}
          pending={form.pending}
          error={form.error}
          saved={form.saved}
          onSave={save}
          onDiscard={form.discard}
        />
      </div>
    </form>
  );
}
