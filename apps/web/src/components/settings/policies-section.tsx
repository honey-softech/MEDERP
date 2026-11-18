"use client";

import { SaveBar } from "@/components/settings/save-bar";
import { SettingRow } from "@/components/settings/setting-row";
import { ToggleField } from "@/components/settings/toggle-field";
import { useSettingsForm } from "@/components/settings/use-settings-form";

type PoliciesValues = {
  requireSignatureForApproval: boolean;
  aiScribeEnabled: boolean;
};

export function PoliciesSection({
  initial,
  coverage,
}: {
  initial: PoliciesValues;
  coverage: { total: number; missing: number; doctorsMissing: number };
}) {
  const form = useSettingsForm(initial);
  const turningOnWithGaps =
    form.values.requireSignatureForApproval &&
    !form.baseline.requireSignatureForApproval &&
    coverage.doctorsMissing > 0;

  function save() {
    const body: Record<string, unknown> = {};
    if (form.values.requireSignatureForApproval !== form.baseline.requireSignatureForApproval) {
      body.requireSignatureForApproval = form.values.requireSignatureForApproval;
    }
    if (form.values.aiScribeEnabled !== form.baseline.aiScribeEnabled) {
      body.aiScribeEnabled = form.values.aiScribeEnabled;
    }
    void form.save(body, "Could not save policies.");
  }

  const coverageText =
    coverage.missing === 0
      ? `All ${coverage.total} active staff have a signature on file.`
      : `${coverage.missing} of ${coverage.total} active staff have no signature on file${
          coverage.doctorsMissing > 0 ? `, including ${coverage.doctorsMissing} doctor(s).` : "."
        }`;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (form.dirty) save();
      }}
    >
      <SettingRow
        label="Signature before approval"
        hint="A doctor needs a signature on file before approving a visit summary."
        detail="Signatures are uploaded when you edit a user under Hospital users. Only a hospital admin can add the image. When this is off, approval still works and the summary prints a name-only sign-off."
      >
        <ToggleField
          label="Require a signature before approving a visit summary"
          checked={form.values.requireSignatureForApproval}
          onChange={(requireSignatureForApproval) => form.patch({ requireSignatureForApproval })}
        />
      </SettingRow>
      <p className="pt-3 text-sm text-text-secondary">{coverageText}</p>
      {turningOnWithGaps ? (
        <p className="mt-3 rounded-lg bg-warning-bg px-3 py-3 text-sm text-text-primary">
          {coverage.doctorsMissing} doctor(s) have no signature yet and will not be able to approve visit summaries
          until you upload one for them.
        </p>
      ) : null}

      <SettingRow
        label="AI consult scribe"
        hint="Let doctors record a consultation after the patient agrees."
        detail="Audio is sent to OpenAI to make a transcript and a draft note, then discarded. The doctor reviews the draft, and nothing is sent to the pharmacy until they approve. Turn this on only if the hospital accepts that patient information in the recording is processed by OpenAI."
      >
        <ToggleField
          label="Allow doctors to record consultations"
          checked={form.values.aiScribeEnabled}
          onChange={(aiScribeEnabled) => form.patch({ aiScribeEnabled })}
        />
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
