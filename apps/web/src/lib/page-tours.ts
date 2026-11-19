import { isTourRole, type TourRole } from "@/lib/tour-steps";

export type PageTourSide = "top" | "right" | "bottom" | "left";

export type PageTourStep = {
  /** `data-tour` value on the page. Omitted for the closing step, which is not anchored. */
  anchor?: string;
  title: string;
  description: string;
  side?: PageTourSide;
  /** Omit to show the step for every tour role that can open the page. */
  roles?: TourRole[];
  /** Last step. Offers the menu tour and the written guide. */
  offerMenu?: boolean;
};

export type PageTour = {
  id: string;
  match: (pathname: string) => boolean;
  steps: PageTourStep[];
};

const FRONT_DESK: TourRole[] = ["RECEPTIONIST", "NURSE_RECEPTIONIST", "SUPER_ADMIN"];
const CLINICAL: TourRole[] = ["DOCTOR", "NURSE", "NURSE_RECEPTIONIST", "SUPER_ADMIN", "RECEPTIONIST"];
const NURSING: TourRole[] = ["NURSE", "NURSE_RECEPTIONIST"];

function close(description: string): PageTourStep {
  return {
    title: "Tour this page again",
    description,
    offerMenu: true,
  };
}

const PAGE_TOURS: PageTour[] = [
  {
    id: "book-visit",
    match: (pathname) => pathname === "/appointments/new",
    steps: [
      {
        anchor: "page:book-patient",
        title: "Find the patient",
        description: "Search the register first. Register someone new only when they are not already on file.",
        side: "bottom",
      },
      {
        anchor: "page:book-doctor",
        title: "Doctor and department",
        description: "The visit is booked against this doctor. Their hours decide which times you can pick.",
        side: "bottom",
      },
      {
        anchor: "page:book-when",
        title: "Day and time",
        description: "A booked visit uses a free slot. A walk-in is for today and joins the live queue.",
        side: "top",
      },
      {
        anchor: "page:book-save",
        title: "Save the visit",
        description: "Check in now when the patient is already here. That issues today's token.",
        side: "top",
      },
      close("Take a tour, in the sidebar, repeats this page. Tour the menu when you want the rest of the sidebar."),
    ],
  },
  {
    id: "vitals",
    match: (pathname) => /^\/appointments\/[^/]+\/vitals$/.test(pathname),
    steps: [
      {
        anchor: "page:vitals-patient",
        title: "This visit",
        description: "You are recording vitals for this patient and token. Back to visit returns to the consult.",
        side: "bottom",
      },
      {
        anchor: "page:vitals-form",
        title: "Height, weight, and readings",
        description: "Height, weight, and temperature are required. The other readings are optional. Saving sends the doctor what you entered.",
        side: "top",
        roles: [...NURSING, "DOCTOR", "SUPER_ADMIN"],
      },
      close("Take a tour repeats this screen. The written guide has the same steps in longer form."),
    ],
  },
  {
    id: "visit",
    match: (pathname) => /^\/appointments\/(?!new$)[^/]+$/.test(pathname),
    steps: [
      {
        anchor: "page:visit-header",
        title: "This patient",
        description: "Token, status, and the doctor for this visit. Move to the previous or next patient in today's queue from here.",
        side: "bottom",
      },
      {
        anchor: "page:visit-context",
        title: "History and vitals",
        description: "Allergies, earlier history, and the vitals already recorded. Check these before you write.",
        side: "right",
        roles: ["DOCTOR"],
      },
      {
        anchor: "page:visit-context",
        title: "What the doctor will see",
        description: "Allergies and the vitals on this visit. Record or update vitals from here when it is your job.",
        side: "right",
        roles: [...NURSING, "RECEPTIONIST", "SUPER_ADMIN"],
      },
      {
        anchor: "page:visit-work",
        title: "The consult",
        description: "Complaint, examination, diagnosis, medicines, and follow-up. Finish the visit when the summary is ready.",
        side: "left",
        roles: ["DOCTOR"],
      },
      {
        anchor: "page:visit-work",
        title: "Fee, vitals, and check-in",
        description: "Record the consultation fee, check the patient in, and open vitals. The doctor writes the assessment after that.",
        side: "top",
        roles: [...FRONT_DESK, "NURSE"],
      },
      close("Take a tour repeats this visit. Tour the menu for the rest of the sidebar, or open the user guide."),
    ],
  },
  {
    id: "appointments",
    match: (pathname) => pathname === "/appointments",
    steps: [
      {
        anchor: "page:appt-book",
        title: "Book or add a walk-in",
        description: "Book a future slot, add someone who has just arrived, or register a patient who is not on file yet.",
        side: "bottom",
        roles: CLINICAL,
      },
      {
        anchor: "page:appt-views",
        title: "Week, month, or list",
        description: "Week and month are the day book. List is the same visits in a single column.",
        side: "bottom",
      },
      {
        anchor: "page:appt-filters",
        title: "Jump to a day",
        description: "Filter by date, doctor, or department when the calendar is too wide.",
        side: "bottom",
      },
      close("Take a tour repeats this calendar. Tour the menu when you want the sidebar explained."),
    ],
  },
  {
    id: "patient",
    match: (pathname) => /^\/patients\/(?!new$)[^/]+$/.test(pathname),
    steps: [
      {
        anchor: "page:patient-actions",
        title: "What you can do from this record",
        description: "Edit the details, book a visit, add a walk-in, or collect a fee. The actions follow your role.",
        side: "bottom",
      },
      {
        anchor: "page:patient-profile",
        title: "Profile",
        description: "Phone, address, allergies, and history. This is the person the rest of the hospital will see.",
        side: "top",
      },
      {
        anchor: "page:patient-history",
        title: "Earlier visits",
        description: "Open a past visit for the summary, the prescription, or a lab report.",
        side: "top",
      },
      close("Take a tour repeats this record. The user guide covers the same daily steps in writing."),
    ],
  },
  {
    id: "patients",
    match: (pathname) => pathname === "/patients",
    steps: [
      {
        anchor: "page:patients-toolbar",
        title: "Search before you add",
        description: "Look up a name, phone, or UHID first. Register a patient only when they are not already here.",
        side: "bottom",
      },
      {
        anchor: "page:patients-register",
        title: "The register",
        description: "Open a row to see the record, earlier visits, and the next booking.",
        side: "top",
      },
      close("Take a tour repeats this register. Tour the menu for the rest of the sidebar."),
    ],
  },
  {
    id: "queue",
    match: (pathname) => pathname === "/queue",
    steps: [
      {
        anchor: "page:queue-day",
        title: "Which day",
        description: "Today is the live queue. Move to another day when you need a past list.",
        side: "bottom",
      },
      {
        anchor: "page:queue-summary",
        title: "Waiting and with the doctor",
        description: "The counts update with the list. Each doctor has a separate queue and their own tokens.",
        side: "bottom",
      },
      {
        anchor: "page:queue-board",
        title: "Each doctor's queue",
        description: "Patients are grouped by doctor. An empty group is a doctor who has not had a check-in yet today.",
        side: "top",
      },
      {
        anchor: "page:queue-walkin",
        title: "Add a walk-in",
        description: "Someone who arrived without a booking. They join today's queue after you save.",
        side: "left",
        roles: [...FRONT_DESK, "NURSE", "DOCTOR"],
      },
      {
        anchor: "page:queue-card",
        title: "One patient",
        description: "Open the visit, record the fee, or start the consult from the card. The badges show vitals and whether the summary is done.",
        side: "top",
        roles: ["DOCTOR"],
      },
      {
        anchor: "page:queue-card",
        title: "One patient",
        description: "Check them in, record the fee, or open vitals. The token is the number the patient is waiting on.",
        side: "top",
        roles: ["RECEPTIONIST", "NURSE", "NURSE_RECEPTIONIST", "SUPER_ADMIN"],
      },
      close("Take a tour repeats this queue. Tour the menu when you want every sidebar item explained."),
    ],
  },
  {
    id: "collections",
    match: (pathname) => pathname === "/billing/collections",
    steps: [
      {
        anchor: "page:collections-date",
        title: "Pick the day",
        description: "Collections are for one date. Change the day to see what was received then.",
        side: "bottom",
      },
      {
        anchor: "page:collections-totals",
        title: "What came in",
        description: "Net collection, split by cash and card, and how many payments were recorded.",
        side: "bottom",
      },
      {
        anchor: "page:collections-doctors",
        title: "By doctor",
        description: "The same money, grouped by the doctor on the visit. Use it when someone asks what their clinic collected.",
        side: "top",
      },
      close("Take a tour repeats this page. Monthly reports are the longer view of the same money."),
    ],
  },
  {
    id: "billing",
    match: (pathname) => pathname === "/billing",
    steps: [
      {
        anchor: "page:billing-actions",
        title: "Start from here",
        description: "Raise an invoice, collect an advance, or jump to today's collections and the monthly reports.",
        side: "bottom",
      },
      {
        anchor: "page:billing-list",
        title: "Recent invoices",
        description: "Open a row for the bill, what was paid, and what is still due.",
        side: "top",
      },
      close("Take a tour repeats this list. Tour the menu for collections, reports, and the rest of the sidebar."),
    ],
  },
  {
    id: "nurse",
    match: (pathname) => pathname === "/nurse",
    steps: [
      {
        anchor: "page:nurse-intro",
        title: "Your working list",
        description: "Bookings and walk-ins land here when vitals are still missing. Add a walk-in if reception has not.",
        side: "bottom",
        roles: NURSING,
      },
      {
        anchor: "page:nurse-stats",
        title: "Pending and done",
        description: "Pending is still waiting on you. Arrived means they are in the clinic. Recorded is already with the doctor.",
        side: "bottom",
        roles: NURSING,
      },
      {
        anchor: "page:nurse-pending",
        title: "Record vitals",
        description: "Open the patient, enter height, weight, and temperature, and save. The doctor sees it on the visit.",
        side: "top",
        roles: NURSING,
      },
      close("Take a tour repeats the nurse station. The user guide has the same steps in writing."),
    ],
  },
  {
    id: "wards",
    match: (pathname) => pathname === "/wards",
    steps: [
      {
        anchor: "page:wards-actions",
        title: "Admit or set up",
        description: "Admit a patient into a free bed. Ward setup is where beds and wards are created.",
        side: "bottom",
      },
      {
        anchor: "page:wards-stats",
        title: "Beds at a glance",
        description: "Occupied, free, and beds still in housekeeping. This is the live picture of the ward.",
        side: "bottom",
      },
      {
        anchor: "page:wards-board",
        title: "Each bed",
        description: "Open a stay from the bed. Housekeeping marks a bed ready after a discharge.",
        side: "top",
      },
      close("Take a tour repeats the ward board. Tour the menu for the rest of the hospital."),
    ],
  },
  {
    id: "hospital-users",
    match: (pathname) => pathname === "/hospital/users",
    steps: [
      {
        anchor: "page:users-seats",
        title: "Seats on this plan",
        description: "How many staff logins the subscription includes, and how many are already in use.",
        side: "bottom",
        roles: ["SUPER_ADMIN"],
      },
      {
        anchor: "page:users-create",
        title: "Create a user",
        description: "Add a doctor, receptionist, or nurse and set the role before they sign in. Edit changes an existing login.",
        side: "left",
        roles: ["SUPER_ADMIN"],
      },
      {
        anchor: "page:users-list",
        title: "Who can sign in",
        description: "Name, mobile, role, and whether the account is active. Open Edit to change any of those.",
        side: "top",
        roles: ["SUPER_ADMIN"],
      },
      close("Take a tour repeats this directory. Join requests are the people who asked to join on their own."),
    ],
  },
  {
    id: "hospital-settings",
    match: (pathname) => pathname === "/hospital/settings",
    steps: [
      {
        anchor: "page:settings-nav",
        title: "Sections",
        description: "Profile is the name and letterhead. Front desk, communication, doctors, and policies are the rest of the setup.",
        side: "right",
        roles: ["SUPER_ADMIN"],
      },
      {
        anchor: "page:settings-panel",
        title: "The section you are in",
        description: "Changes here are what print on bills and certificates, and what the front desk is allowed to do.",
        side: "left",
        roles: ["SUPER_ADMIN"],
      },
      close("Take a tour repeats these settings. The user guide lists the same sections."),
    ],
  },
];

export function getPageTour(role: string | undefined, pathname: string) {
  if (!isTourRole(role)) return null;
  const tour = PAGE_TOURS.find((item) => item.match(pathname));
  if (!tour) return null;
  const steps = tour.steps.filter((step) => !step.roles || step.roles.includes(role));
  if (!steps.some((step) => step.anchor)) return null;
  return { id: tour.id, steps };
}

/** Drop anchored steps whose target is not on the page. Closing steps stay. */
export function selectPageTourSteps(steps: PageTourStep[], isPresent: (anchor: string) => boolean) {
  return steps.filter((step) => !step.anchor || isPresent(step.anchor));
}

export function pageTourSelector(anchor: string) {
  return `[data-tour="${anchor}"]`;
}

const SEEN_PREFIX = "mederp-page-tour-seen:";

export function pageTourSeenKey(viewerId: string, tourId: string) {
  return `${SEEN_PREFIX}${viewerId}:${tourId}`;
}

export function matchingPageTourIds(pathname: string) {
  return PAGE_TOURS.filter((tour) => tour.match(pathname)).map((tour) => tour.id);
}

export function pageTourCatalog() {
  return PAGE_TOURS.map((tour) => ({
    id: tour.id,
    steps: tour.steps.map((step) => ({
      anchor: step.anchor ?? null,
      title: step.title,
      description: step.description,
      roles: step.roles ?? null,
      offerMenu: Boolean(step.offerMenu),
    })),
  }));
}
