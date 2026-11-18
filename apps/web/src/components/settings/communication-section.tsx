"use client";

import { fieldClass } from "@/lib/ui";
import { SaveBar } from "@/components/settings/save-bar";
import { SettingRow } from "@/components/settings/setting-row";
import { ToggleField } from "@/components/settings/toggle-field";
import { useSettingsForm } from "@/components/settings/use-settings-form";
import { WHATSAPP_LANGUAGES } from "@/lib/messaging/whatsapp-language";

type CommunicationValues = {
  whatsappLanguage: string;
  followUpReminderEnabled: boolean;
  followUpReminderDaysBefore: 1 | 2;
};

export function CommunicationSection({ initial }: { initial: CommunicationValues }) {
  const form = useSettingsForm(initial);

  function save() {
    const body: Record<string, unknown> = {};
    if (form.values.whatsappLanguage !== form.baseline.whatsappLanguage) {
      body.whatsappLanguage = form.values.whatsappLanguage;
    }
    if (form.values.followUpReminderEnabled !== form.baseline.followUpReminderEnabled) {
      body.followUpReminderEnabled = form.values.followUpReminderEnabled;
    }
    if (form.values.followUpReminderDaysBefore !== form.baseline.followUpReminderDaysBefore) {
      body.followUpReminderDaysBefore = form.values.followUpReminderDaysBefore;
    }
    void form.save(body, "Could not save communication settings.");
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (form.dirty) save();
      }}
    >
      <SettingRow
        label="WhatsApp language"
        hint="Default language for patient messages."
        detail="Used for the visit summary, bill, investigation list, medical certificate, and appointment reminder. On a patient record, reception can pick a different language. Login codes stay in English."
      >
        <div className="w-48">
          <select
            className={`${fieldClass} !mt-0`}
            aria-label="WhatsApp language"
            value={form.values.whatsappLanguage}
            onChange={(event) => form.patch({ whatsappLanguage: event.target.value })}
          >
            {WHATSAPP_LANGUAGES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </SettingRow>

      <SettingRow
        label="Follow-up reminder"
        hint="WhatsApp patients automatically before a follow-up visit."
        detail="The reminder goes out around 9:00, one or two days before. Reception can still send a reminder by hand from the visit."
      >
        <div className="flex flex-wrap items-center gap-3">
          <ToggleField
            label="Send follow-up reminders"
            checked={form.values.followUpReminderEnabled}
            onChange={(followUpReminderEnabled) => form.patch({ followUpReminderEnabled })}
          />
          <div className="w-44">
            <select
              className={`${fieldClass} !mt-0`}
              aria-label="When to send the follow-up reminder"
              disabled={!form.values.followUpReminderEnabled}
              value={form.values.followUpReminderDaysBefore}
              onChange={(event) =>
                form.patch({ followUpReminderDaysBefore: event.target.value === "2" ? 2 : 1 })
              }
            >
              <option value={1}>1 day before</option>
              <option value={2}>2 days before</option>
            </select>
          </div>
        </div>
      </SettingRow>

      <SaveBar
        dirty={form.dirty}
        pending={form.pending}
        error={form.error}
        saved={form.saved}
        onSave={save}
        onDiscard={form.discard}
      />
    </form>
  );
}
