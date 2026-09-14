import { redirect } from "next/navigation";

/** Doctor profile lives on Hospital settings — keep this URL as a redirect. */
export default function AdminDoctorProfileRedirect() {
  redirect("/hospital/settings");
}
