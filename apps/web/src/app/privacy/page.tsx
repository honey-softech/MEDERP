import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AuthBack } from "@/components/auth-back";
import { Fraunces, Source_Sans_3 } from "next/font/google";

export const metadata: Metadata = {
  title: "Privacy Policy · MedERP",
  description:
    "How the MedERP website, Android app, and iOS app collect, use, and share staff and patient information.",
};

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-landing-display",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-landing-body",
});

export default function PrivacyPage() {
  return (
    <div className={`landing text-[#0c1f2e] ${display.variable} ${body.variable}`}>
      <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-2.5">
          <AuthBack href="/" />
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Image src="/mederp-icon.png" alt="" width={36} height={36} className="h-9 w-9 rounded-md" />
            <span className="landing-brand text-xl font-semibold text-[#0c2f2c]">MedERP</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
        <h1 className="landing-brand text-4xl font-semibold text-[#0c2f2c]">Privacy Policy</h1>
        <p className="mt-3 text-sm text-[#3d5668]">Last updated 25 October 2026</p>
        <p className="mt-6 text-base leading-relaxed text-[#1f4a46]">
          This policy explains how MedERP at{" "}
          <a className="font-medium underline" href="https://mederp.co.in">
            mederp.co.in
          </a>{" "}
          and the MedERP Android and iOS apps handle information. MedERP is a clinic and hospital workspace for
          authorised staff. It is managed by Hanisha Exim. The clinic that employs you decides what patient
          information is entered and who on its staff may see it.
        </p>

        <Section title="Who this applies to">
          <p>
            The website and app are for clinic staff, such as reception, nurses, doctors, pharmacy, lab, and
            administrators. Patients do not create their own MedERP accounts. A clinic may store a
            patient&apos;s details, including a child&apos;s details, as part of that patient&apos;s care.
          </p>
        </Section>

        <Section title="Information clinics and staff provide">
          <ul>
            <li>Account details: name, mobile number, email, username, role, and password.</li>
            <li>
              Clinic details: clinic name, address, phone number, billing contact, and subscription choices.
            </li>
            <li>
              Patient and clinical records the clinic enters: identity and contact details, appointments,
              queue tokens, vitals, diagnoses, prescriptions, investigations, certificates, ward stays, and
              related notes.
            </li>
            <li>Bills, payments recorded by the clinic, pharmacy stock, and lab records.</li>
            <li>Files a staff member chooses to upload, such as a report, and bills they choose to save.</li>
            <li>Help requests, including the mobile number used to receive a one-time code.</li>
          </ul>
        </Section>

        <Section title="Information collected from the device">
          <ul>
            <li>A sign-in session stored in a first-party cookie named mederp_session.</li>
            <li>The mobile number last used on the sign-in screen, saved on that device so it can be filled in again.</li>
            <li>
              A push-notification token and the notification title and message, when notifications are turned
              on. Delivery uses Firebase Cloud Messaging.
            </li>
            <li>Basic connection data needed to operate the service, such as the time of a request.</li>
          </ul>
          <p>
            Neither app shows ads or includes a third-party analytics tracker. The Android app does not ask
            for location, contacts, microphone, or camera. The iOS permissions are listed in the iOS app
            section below.
          </p>
        </Section>

        <Section title="How information is used">
          <ul>
            <li>To sign staff in and show each person only the clinic workspace their role allows.</li>
            <li>To run OPD, nursing, doctor consults, billing, pharmacy, lab, and certificates.</li>
            <li>To send staff alerts about work in the clinic.</li>
            <li>To collect the clinic&apos;s MedERP subscription through Razorpay.</li>
            <li>To send a WhatsApp message or bill when the clinic chooses to send one.</li>
            <li>To answer a help request and keep the service secure and reliable.</li>
          </ul>
          <p>MedERP does not sell personal information.</p>
        </Section>

        <Section title="Who information is shared with">
          <ul>
            <li>Staff at the same clinic, limited by the role the clinic assigns.</li>
            <li>Razorpay, to process the clinic&apos;s subscription. MedERP stores payment reference IDs, not full card numbers.</li>
            <li>WhatsApp (Meta), when the clinic sends a WhatsApp message or document to a mobile number.</li>
            <li>Google Firebase, to deliver push notifications to the app.</li>
            <li>The infrastructure provider that hosts MedERP.</li>
            <li>A regulator, court, or other party when the law requires it.</li>
          </ul>
        </Section>

        <Section title="Health information">
          <p>
            Clinical records in MedERP are health information. They are used so the clinic can care for
            patients and run its operations. They are not used for advertising. The clinic is responsible for
            the accuracy of the records it enters and for giving its patients any notice the law requires.
          </p>
        </Section>

        <Section title="Android app">
          <p>The Android app opens the MedERP website and uses these device permissions:</p>
          <ul>
            <li>Internet, to load the clinic workspace.</li>
            <li>Notifications and vibration, for staff alerts.</li>
            <li>Files the user picks, to upload a document or to save a bill PDF where the user chooses.</li>
          </ul>
        </Section>

        <Section title="iOS app">
          <p>The iOS app opens the MedERP website and uses these device permissions:</p>
          <ul>
            <li>Internet, to load the clinic workspace.</li>
            <li>Notifications, for staff alerts.</li>
            <li>Camera, when staff choose to take a photo for a patient record, signature, or document upload.</li>
            <li>Photo library, when staff choose an existing photo or document to attach.</li>
            <li>Location, only while the app is open and only when a hospital page requests it.</li>
            <li>Files the user picks, to upload a document or to save a bill PDF where the user chooses.</li>
          </ul>
          <p>The iOS app does not ask for contacts or the microphone.</p>
        </Section>

        <Section title="How long information is kept">
          <p>
            Clinic and patient records stay in the clinic&apos;s workspace while that clinic uses MedERP, and
            longer when a medical, billing, tax, or legal duty requires it. Sign-in sessions end when the
            staff member signs out or the session expires. A notification token is kept while that device is
            registered for alerts.
          </p>
        </Section>

        <Section title="Requests and choices">
          <p>
            Staff can sign out, turn off notifications in the phone settings, and choose not to upload or save
            a file. Patient-record corrections and access requests are handled by the clinic that entered the
            record. To close a clinic subscription or ask a question about this policy, use the{" "}
            <Link href="/help" className="font-medium underline">
              Help
            </Link>{" "}
            page.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If this policy changes, the updated version will be posted on this page with a new date. Continued
            use of MedERP after the update means the clinic and its staff are using the service under the
            revised policy.
          </p>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-[#0c2f2c]">{title}</h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-[#1f4a46] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
