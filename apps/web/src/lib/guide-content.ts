export type GuideRole = "admin" | "doctor" | "receptionist" | "nurse";

export type GuideBlock = {
  heading: string;
  body: string[];
};

export type GuideDoc = {
  id: GuideRole;
  title: string;
  intro: string;
  blocks: GuideBlock[];
};

export const GUIDE_ROLES: { id: GuideRole; label: string }[] = [
  { id: "admin", label: "Hospital admin" },
  { id: "doctor", label: "Doctor" },
  { id: "receptionist", label: "Receptionist" },
  { id: "nurse", label: "Nurse" },
];

export const GUIDES: Record<GuideRole, GuideDoc> = {
  admin: {
    id: "admin",
    title: "Hospital admin guide",
    intro: "Use this when you run the hospital on MedERP: people, the outpatient day, billing, and hospital setup.",
    blocks: [
      {
        heading: "Getting started",
        body: [
          "Sign in with the mobile number your account was created with. The sidebar is grouped by how you work: Clinical, Billing, People, Settings, and Support.",
          "If you also consult, use the Doctor / Admin switch in the header. Doctor view shows the consult menu. Admin view shows hospital setup. Take a tour follows whichever view you are in.",
        ],
      },
      {
        heading: "Add your team",
        body: [
          "People → Hospital users is where you add a doctor, receptionist, or nurse. Set their role before they sign in so they see the right menu.",
          "If someone already has a MedERP login, they can request to join. Approve them under Join requests.",
          "Staff is the directory. Staff leave and Timesheets are where you review time away and attendance.",
        ],
      },
      {
        heading: "A normal outpatient day",
        body: [
          "Patients holds the register. Appointments is the day book. OPD queue shows who is waiting and who is in with a doctor.",
          "Certificates lists medical certificates issued from a visit.",
        ],
      },
      {
        heading: "Billing and hospital setup",
        body: [
          "Billing is where bills are raised. Collections shows what was received and what is still due. Reports summarises the period.",
          "Hospital settings holds the name, timings, and details printed on bills and certificates. Subscription is your plan and renewal. Audit log records important changes.",
          "Helpdesk is for product questions. Take a tour, at the bottom of the sidebar, repeats this walkthrough whenever you want it.",
        ],
      },
    ],
  },
  doctor: {
    id: "doctor",
    title: "Doctor guide",
    intro: "Use this for the consult: the queue, the visit, and certificates.",
    blocks: [
      {
        heading: "Getting started",
        body: [
          "Open OPD queue. That is the list of patients waiting for you. Open a patient to start or continue the visit.",
          "Appointments is the same day as a calendar, if you want to see who is booked before they arrive. Patients is the register, including earlier visits.",
        ],
      },
      {
        heading: "During a visit",
        body: [
          "Vitals recorded by the nurse are on the visit. Write the assessment, medicines, and investigations in the consult.",
          "Issue a certificate from the visit when the patient needs one. Issued certificates are also listed under Certificates.",
        ],
      },
      {
        heading: "If you also administer the hospital",
        body: [
          "The Doctor / Admin switch in the header changes the sidebar. Admin view is for users, settings, and subscription. Switch back to Doctor before the next consult.",
          "Take a tour, at the bottom of the sidebar, walks through this menu again.",
        ],
      },
    ],
  },
  receptionist: {
    id: "receptionist",
    title: "Receptionist guide",
    intro: "Use this for the front desk: register the patient, book the visit, and collect the bill.",
    blocks: [
      {
        heading: "Register and book",
        body: [
          "Search Patients before you add anyone. If they are already on file, open that record so the visit stays on the same person.",
          "From Appointments, book the doctor, the day, and a free slot. The visit then shows on that doctor's OPD queue.",
        ],
      },
      {
        heading: "On the day",
        body: [
          "OPD queue shows who has arrived and who is still waiting. Use it when a patient asks how long they will wait.",
          "Billing raises the bill for the visit. Collections is where you record what they paid and what is still due.",
        ],
      },
      {
        heading: "Your own time",
        body: [
          "Leave and Timesheet are under Support, for your own attendance. Helpdesk is for product questions.",
          "Take a tour, at the bottom of the sidebar, repeats these steps.",
        ],
      },
    ],
  },
  nurse: {
    id: "nurse",
    title: "Nurse guide",
    intro: "Use this for vitals, the queue, and wards.",
    blocks: [
      {
        heading: "Before the doctor",
        body: [
          "Nurse station is your working list. OPD queue is the waiting list for the outpatient clinic.",
          "Open the patient from the queue and record vitals before the doctor starts the consult. The doctor sees those vitals on the visit.",
        ],
      },
      {
        heading: "Patients and wards",
        body: [
          "Patients finds someone who is not in today's queue. Wards is for admitted patients, beds, and the stay.",
          "Certificates is available if you prepare a certificate for a doctor to complete.",
        ],
      },
      {
        heading: "If you also cover the front desk",
        body: [
          "Appointments books the visit. Billing and Collections are for the bill and the payment.",
          "Leave and Timesheet are under Support. Take a tour, at the bottom of the sidebar, walks through your menu again.",
        ],
      },
    ],
  },
};

export function guideRoleForUser(role: string, doctorView: boolean): GuideRole {
  if (doctorView || role === "DOCTOR") return "doctor";
  if (role === "RECEPTIONIST") return "receptionist";
  if (role === "NURSE") return "nurse";
  return "admin";
}
