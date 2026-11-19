export type TourRole =
  | "SUPER_ADMIN"
  | "DOCTOR"
  | "RECEPTIONIST"
  | "NURSE"
  | "NURSE_RECEPTIONIST";

export type TourStepDef = {
  /** Sidebar href this step points at. Omitted for controls that are always in the shell. */
  href?: string;
  /** Set when the step is not a nav link. */
  anchor?: "view-mode" | "account" | "guide" | "take-tour";
  title: string;
  description: string;
};

const ADMIN: TourStepDef[] = [
  {
    href: "/",
    title: "Dashboard",
    description: "Your starting point for the day. Open it to see what needs attention across the hospital.",
  },
  {
    href: "/queue",
    title: "OPD queue",
    description: "See who is waiting, who is with a doctor, and how the outpatient queue is moving.",
  },
  {
    href: "/appointments",
    title: "Appointments",
    description: "The day book. Review booked visits and open a visit from here.",
  },
  {
    href: "/patients",
    title: "Patients",
    description: "Search the hospital register and open a patient's record.",
  },
  {
    href: "/billing",
    title: "Billing",
    description: "Raise and review bills for visits and other charges.",
  },
  {
    href: "/billing/collections",
    title: "Collections",
    description: "See what has been collected and what is still due.",
  },
  {
    href: "/staff",
    title: "Staff",
    description: "The staff directory for doctors, nurses, and the front desk.",
  },
  {
    href: "/hospital/users",
    title: "Hospital users",
    description: "Add a doctor, receptionist, or nurse and choose what they can do.",
  },
  {
    href: "/hospital/join-requests",
    title: "Join requests",
    description: "Approve or decline people who asked to join this hospital.",
  },
  {
    href: "/hospital/leaves",
    title: "Staff leave",
    description: "Review leave requests from the team.",
  },
  {
    href: "/hospital/timesheets",
    title: "Timesheets",
    description: "Check attendance recorded by the team.",
  },
  {
    href: "/hospital/settings",
    title: "Hospital settings",
    description: "Hospital name, timings, and the details printed on bills and certificates.",
  },
  {
    href: "/hospital/subscription",
    title: "Subscription",
    description: "Your plan, trial, and renewal.",
  },
  {
    href: "/hospital/audit-log",
    title: "Audit log",
    description: "A record of important changes made in this hospital.",
  },
  {
    anchor: "view-mode",
    title: "Doctor and admin view",
    description: "Switch to Doctor when you are consulting. Switch back to Admin for users, billing setup, and subscription. The tour follows the view you are in.",
  },
];

const DOCTOR: TourStepDef[] = [
  {
    href: "/",
    title: "Dashboard",
    description: "See today's work and jump into the queue.",
  },
  {
    href: "/queue",
    title: "OPD queue",
    description: "Call the next patient and open the visit. This is where most of the consult happens.",
  },
  {
    href: "/appointments",
    title: "Appointments",
    description: "Your booked visits for the day. Open one to continue a consult.",
  },
  {
    href: "/patients",
    title: "Patients",
    description: "Look up a patient and review earlier visits.",
  },
  {
    href: "/certificates",
    title: "Certificates",
    description: "Issue and review medical certificates you have signed.",
  },
  {
    anchor: "view-mode",
    title: "Doctor and admin view",
    description: "You can switch between the doctor workspace and the hospital admin menu. The tour follows the view you are in.",
  },
];

const RECEPTION: TourStepDef[] = [
  {
    href: "/",
    title: "Dashboard",
    description: "A snapshot of today's appointments and the queue.",
  },
  {
    href: "/patients",
    title: "Register a patient",
    description: "Search first. If the person is new, add them to the hospital register.",
  },
  {
    href: "/appointments",
    title: "Book an appointment",
    description: "Pick the doctor, the day, and a free slot.",
  },
  {
    href: "/queue",
    title: "OPD queue",
    description: "See who has arrived and who is still waiting.",
  },
  {
    href: "/billing",
    title: "Billing",
    description: "Create the bill for a visit.",
  },
  {
    href: "/billing/collections",
    title: "Collections",
    description: "Record what the patient paid and what is still due.",
  },
];

const NURSE: TourStepDef[] = [
  {
    href: "/",
    title: "Dashboard",
    description: "Start here, then move to the nurse station or the queue.",
  },
  {
    href: "/nurse",
    title: "Nurse station",
    description: "Your working list for patients who need vitals or nursing care.",
  },
  {
    href: "/queue",
    title: "OPD queue",
    description: "Open a waiting patient and record vitals before the doctor sees them.",
  },
  {
    href: "/patients",
    title: "Patients",
    description: "Find a patient and open the record.",
  },
  {
    href: "/wards",
    title: "Wards",
    description: "Admitted patients, beds, and ward stays.",
  },
];

const NURSE_FRONT_DESK: TourStepDef[] = [
  ...NURSE,
  {
    href: "/appointments",
    title: "Appointments",
    description: "You also cover the front desk. Book and review visits from here.",
  },
  {
    href: "/billing",
    title: "Billing",
    description: "Raise a bill when you are collecting at the desk.",
  },
];

const CLOSING: TourStepDef[] = [
  {
    anchor: "account",
    title: "Account",
    description: "Your name, mobile number, and sign-in. You can also open the user guide from here.",
  },
  {
    anchor: "guide",
    title: "User guide",
    description: "The written guide for your role. Keep it open while you learn the daily steps.",
  },
  {
    anchor: "take-tour",
    title: "Take the tour again",
    description: "This button stays in the sidebar. Open it any time you want this walkthrough again.",
  },
];

const BY_ROLE: Record<TourRole, TourStepDef[]> = {
  SUPER_ADMIN: [...ADMIN, ...CLOSING],
  DOCTOR: [...DOCTOR, ...CLOSING],
  RECEPTIONIST: [...RECEPTION, ...CLOSING],
  NURSE: [...NURSE, ...CLOSING],
  NURSE_RECEPTIONIST: [...NURSE_FRONT_DESK, ...CLOSING],
};

export function isTourRole(role: string | undefined): role is TourRole {
  return role === "SUPER_ADMIN" || role === "DOCTOR" || role === "RECEPTIONIST" || role === "NURSE" || role === "NURSE_RECEPTIONIST";
}

export function navTourAttr(href: string) {
  return `nav:${href}`;
}

export function tourSelector(step: TourStepDef) {
  if (step.href) return `[data-tour="${navTourAttr(step.href)}"]`;
  if (step.anchor === "view-mode") return '[data-tour="view-mode"]';
  if (step.anchor === "account") return '[data-tour="account"]';
  if (step.anchor === "guide") return '[data-tour="guide"]';
  return '[data-tour="take-tour"]';
}

export function getTourSteps(role: string | undefined, hrefs: string[], includeViewMode: boolean) {
  if (!isTourRole(role)) return [];
  return BY_ROLE[role].filter((step) => {
    if (step.href) return hrefs.includes(step.href);
    if (step.anchor === "view-mode") return includeViewMode;
    return true;
  });
}
