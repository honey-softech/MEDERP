import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PatientForm } from "@/components/patient-form";
import { getCurrentUser } from "@/lib/auth";
import { PATIENT_REGISTER_ROLES } from "@/lib/front-desk";

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
  const user = await getCurrentUser();
  if (!user?.hospitalId) redirect("/login");
  if (!PATIENT_REGISTER_ROLES.includes(user.role)) redirect("/patients");
  const { next } = await searchParams;
  const bookingNext = nextAfterRegister(next);

  return (
    <AppShell title="Register patient">
      <p className="mb-4 text-sm text-slate-500">
        {bookingNext
          ? next === "admit"
            ? "Register the new patient, then continue to admit them to a ward."
            : "Register the new patient, then continue to book their appointment."
          : "Enter the parent's mobile to find an existing family. Children get their own UHID and stay in the same family group. Use the camera to capture a photo."}
      </p>
      <PatientForm
        submitLabel={bookingNext ? "Register and continue booking" : "Register patient"}
        nextHref={bookingNext}
      />
    </AppShell>
  );
}
