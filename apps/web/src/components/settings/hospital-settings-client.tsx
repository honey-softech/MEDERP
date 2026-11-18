"use client";

import { useState, type ComponentProps } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HospitalBrandingForm } from "@/components/hospital-branding-form";
import { OtpDangerAction } from "@/components/otp-danger-action";
import { CommunicationSection } from "@/components/settings/communication-section";
import { DoctorsSection } from "@/components/settings/doctors-section";
import { FrontDeskSection } from "@/components/settings/front-desk-section";
import { PoliciesSection } from "@/components/settings/policies-section";
import { isSettingsTab, SettingsLayout, type SettingsTabId } from "@/components/settings/settings-layout";

type SettingsData = {
  branding: ComponentProps<typeof HospitalBrandingForm>["initial"];
  frontDesk: ComponentProps<typeof FrontDeskSection>["initial"];
  communication: ComponentProps<typeof CommunicationSection>["initial"];
  policies: ComponentProps<typeof PoliciesSection>["initial"];
  coverage: ComponentProps<typeof PoliciesSection>["coverage"];
  doctors: ComponentProps<typeof DoctorsSection>["doctors"];
  profile: ComponentProps<typeof DoctorsSection>["profile"];
};

export function HospitalSettingsClient({ data }: { data: SettingsData }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("tab");
  const tab: SettingsTabId = isSettingsTab(requested) ? requested : "profile";
  const [doctorsMounted, setDoctorsMounted] = useState(tab === "doctors");

  function onTab(next: SettingsTabId) {
    if (next === "doctors") setDoctorsMounted(true);
    const query = new URLSearchParams(params.toString());
    if (next === "profile") query.delete("tab");
    else query.set("tab", next);
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <SettingsLayout tab={tab} onTab={onTab}>
      <div className={tab === "profile" ? "" : "hidden"}>
        <HospitalBrandingForm initial={data.branding} />
      </div>
      <div className={tab === "front-desk" ? "" : "hidden"}>
        <FrontDeskSection initial={data.frontDesk} />
      </div>
      <div className={tab === "communication" ? "" : "hidden"}>
        <CommunicationSection initial={data.communication} />
      </div>
      {doctorsMounted ? (
        <div className={tab === "doctors" ? "" : "hidden"}>
          <DoctorsSection doctors={data.doctors} profile={data.profile} />
        </div>
      ) : null}
      <div className={tab === "policies" ? "" : "hidden"}>
        <PoliciesSection initial={data.policies} coverage={data.coverage} />
      </div>
      <div className={tab === "danger" ? "mt-4" : "hidden"}>
        <OtpDangerAction
          grouped
          title="Close hospital"
          description="Clinical records stay on file. The hospital phone and every staff login number, including this super admin, are released so they can be used again. The monthly subscription is cancelled so no further charges are taken. Confirm with the login OTP sent on WhatsApp."
          sendUrl="/api/hospital/close/otp"
          confirmUrl="/api/hospital/close"
          confirmLabel="Close hospital"
        />
      </div>
    </SettingsLayout>
  );
}
