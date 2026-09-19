import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PatientForm } from "@/components/patient-form";
import { canRegisterPatient, requireHospitalPage } from "@/lib/front-desk";

function nextAfterRegister(next?: string) {
  if (next === "walkin") return "/appointments/new?walkin=1";
  if (next === "appointment") return "/appointments/new";
  if (next === "admit") return "/wards/admit";
  return undefined;
}

export default async function NewPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await requireHospitalPage();
  if (!canRegisterPatient(user)) redirect("/patients");
  const { next } = await searchParams;
  const bookingNext = nextAfterRegister(next);

  return (
    <AppShell title="Register patient">
      <p className="mb-4 text-sm text-slate-500">
        {bookingNext
          ? next === "admit"
            ? "Register the new patient, then continue to admit them to a ward."
            : "Register the new patient, then continue to book their appointment."
          : "Name, date of birth, and mobile are enough. For a newborn without a name, tick Unnamed infant and enter the parent — it saves as Baby of the parent. Extra details stay collapsed and can be added later from Edit."}
      </p>
      <PatientForm
        submitLabel={bookingNext ? "Register and continue booking" : "Register patient"}
        nextHref={bookingNext}
      />
    </AppShell>
  );
}
