export function HelpdeskDiagnosisPanel({
  createdBy,
  contactName,
  contactMobile,
  hospital,
}: {
  createdBy?: {
    id: string;
    username: string;
    role: string;
    mobile: string;
    isActive: boolean;
    isVerified: boolean;
  } | null;
  contactName?: string | null;
  contactMobile?: string | null;
  hospital?: {
    name: string;
    code: string;
    isActive: boolean;
    subscriptionTier: string;
    trialEndsAt: Date | string | null;
    extraStaffSlots: number;
    includedStaffSlots: number;
    unlimitedStaffSeats: boolean;
  } | null;
}) {
  const trialLabel = hospital?.trialEndsAt
    ? new Date(hospital.trialEndsAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "No trial end set";

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="font-semibold text-slate-900">Diagnosis</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <p className="font-medium text-slate-800">Requester</p>
          {createdBy ? (
            <ul className="mt-2 space-y-1 text-slate-600">
              <li>
                {createdBy.username} · {createdBy.role.replace(/_/g, " ")}
              </li>
              <li>Mobile {createdBy.mobile}</li>
              <li className={createdBy.isActive ? "text-teal-700" : "text-red-600"}>
                {createdBy.isActive ? "Account active" : "Account deactivated"}
              </li>
              <li className={createdBy.isVerified ? "text-teal-700" : "text-amber-700"}>
                {createdBy.isVerified ? "Verified" : "Not verified"}
              </li>
            </ul>
          ) : (
            <ul className="mt-2 space-y-1 text-slate-600">
              <li>{contactName || "Unknown contact"}</li>
              <li>{contactMobile || "No mobile on ticket"}</li>
              <li className="text-amber-700">No linked AppUser</li>
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <p className="font-medium text-slate-800">Hospital</p>
          {hospital ? (
            <ul className="mt-2 space-y-1 text-slate-600">
              <li>
                {hospital.name} ({hospital.code})
              </li>
              <li className={hospital.isActive ? "text-teal-700" : "text-red-600"}>
                {hospital.isActive ? "Hospital access on" : "Hospital access stopped"}
              </li>
              <li>Plan {hospital.subscriptionTier}</li>
              <li>
                Seats{" "}
                {hospital.unlimitedStaffSeats
                  ? "unlimited"
                  : `${hospital.includedStaffSlots}+${hospital.extraStaffSlots} extra`}
              </li>
              <li>Trial ends {trialLabel}</li>
            </ul>
          ) : (
            <p className="mt-2 text-slate-600">No hospital linked to this ticket.</p>
          )}
        </div>
      </div>
    </section>
  );
}
