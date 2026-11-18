"use client";

import { RadioGroupField } from "@/components/settings/radio-group-field";
import { SaveBar } from "@/components/settings/save-bar";
import { SettingRow } from "@/components/settings/setting-row";
import { ToggleField } from "@/components/settings/toggle-field";
import { useSettingsForm } from "@/components/settings/use-settings-form";

type WalkInLevel = "reception" | "nurses" | "doctors" | "everyone";

type FrontDeskValues = {
  walkInByDoctor: boolean;
  walkInByNurse: boolean;
  nurseAsReceptionist: boolean;
};

const WALK_IN_OPTIONS: { value: WalkInLevel; label: string }[] = [
  { value: "reception", label: "Reception only" },
  { value: "nurses", label: "Reception and nurses" },
  { value: "everyone", label: "Reception, nurses and doctors" },
];

function walkInLevel(values: FrontDeskValues): WalkInLevel {
  if (values.walkInByDoctor && values.walkInByNurse) return "everyone";
  if (values.walkInByDoctor) return "doctors";
  if (values.walkInByNurse) return "nurses";
  return "reception";
}

function walkInFlags(level: WalkInLevel): Pick<FrontDeskValues, "walkInByDoctor" | "walkInByNurse"> {
  if (level === "everyone") return { walkInByDoctor: true, walkInByNurse: true };
  if (level === "doctors") return { walkInByDoctor: true, walkInByNurse: false };
  if (level === "nurses") return { walkInByDoctor: false, walkInByNurse: true };
  return { walkInByDoctor: false, walkInByNurse: false };
}

export function FrontDeskSection({ initial }: { initial: FrontDeskValues }) {
  const form = useSettingsForm(initial);

  function save() {
    const body: Record<string, unknown> = {};
    if (form.values.walkInByDoctor !== form.baseline.walkInByDoctor) body.walkInByDoctor = form.values.walkInByDoctor;
    if (form.values.walkInByNurse !== form.baseline.walkInByNurse) body.walkInByNurse = form.values.walkInByNurse;
    if (form.values.nurseAsReceptionist !== form.baseline.nurseAsReceptionist) {
      body.nurseAsReceptionist = form.values.nurseAsReceptionist;
    }
    void form.save(body, "Could not save front desk settings.");
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (form.dirty) save();
      }}
    >
      <SettingRow
        label="Walk-in registration"
        hint="Choose who else can register a walk-in. Reception and hospital admin always can."
        detail="A doctor can add a walk-in to their own OPD queue. A nurse can register a walk-in and assign them to a doctor."
      >
        <RadioGroupField
          name="walk-in-registration"
          ariaLabel="Walk-in registration"
          value={walkInLevel(form.values)}
          options={
            walkInLevel(form.values) === "doctors" || walkInLevel(form.baseline) === "doctors"
              ? [
                  WALK_IN_OPTIONS[0],
                  WALK_IN_OPTIONS[1],
                  { value: "doctors" as const, label: "Reception and doctors" },
                  WALK_IN_OPTIONS[2],
                ]
              : WALK_IN_OPTIONS
          }
          onChange={(level) => form.patch(walkInFlags(level))}
        />
        {form.values.nurseAsReceptionist ? (
          <p className="mt-2 max-w-xs text-xs text-text-secondary">
            Nurses already cover reception, so they can add walk-ins even when this is Reception only.
          </p>
        ) : null}
      </SettingRow>

      <SettingRow
        label="Nurses cover reception"
        hint="Let every nurse register patients, run the queue, collect bills, and check patients out."
        detail="This does not add seats. Each nurse still counts as one login on your plan. You can still add a dedicated receptionist if seats remain."
      >
        <ToggleField
          label="Nurses cover reception"
          checked={form.values.nurseAsReceptionist}
          onChange={(nurseAsReceptionist) => form.patch({ nurseAsReceptionist })}
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
