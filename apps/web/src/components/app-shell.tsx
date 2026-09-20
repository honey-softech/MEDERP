import { AppShellFrame, type NavSection } from "@/components/app-shell-frame";
import { getCurrentUser, isPlatformRole, SESSION_COOKIE } from "@/lib/auth";
import { isNurseReceptionist } from "@/lib/authz/hospital";
import { hospitalHasWardsModule } from "@/lib/subscription-tiers";
import { hospitalAccessBlocked, isExpiredTrialAllowedPath } from "@/lib/hospital-access";
import { resolveViewContext } from "@/lib/view-mode";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

const staffNav: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/patients", label: "Patients" },
      { href: "/appointments", label: "Appointments" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/staff", label: "Staff" },
      { href: "/wards", label: "Wards" },
      { href: "/pharmacy", label: "Pharmacy" },
      { href: "/lab", label: "Laboratory" },
    ],
  },
  {
    title: "Billing",
    items: [
      { href: "/billing", label: "Billing" },
      { href: "/billing/reports", label: "Reports" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/leave", label: "Leave" },
      { href: "/helpdesk", label: "Helpdesk" },
    ],
  },
];

const doctorNav: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/queue", label: "OPD queue" },
      { href: "/appointments", label: "Appointments" },
      { href: "/patients", label: "Patients" },
      { href: "/wards", label: "Wards" },
    ],
  },
  {
    title: "Hospital",
    items: [
      { href: "/staff", label: "Staff" },
      { href: "/billing", label: "Billing" },
      { href: "/certificates", label: "Certificates" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/leave", label: "Leave" },
      { href: "/helpdesk", label: "Helpdesk" },
    ],
  },
];

const nurseNav: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/nurse", label: "Nurse station" },
      { href: "/staff", label: "Staff" },
      { href: "/wards", label: "Wards" },
      { href: "/patients", label: "Patients" },
      { href: "/appointments", label: "Appointments" },
      { href: "/queue", label: "OPD queue" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/leave", label: "Leave" },
      { href: "/helpdesk", label: "Helpdesk" },
    ],
  },
];

const nurseReceptionistNav: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/nurse", label: "Nurse station" },
      { href: "/staff", label: "Staff" },
      { href: "/patients", label: "Patients" },
      { href: "/appointments", label: "Appointments" },
      { href: "/queue", label: "OPD queue" },
      { href: "/wards", label: "Wards" },
    ],
  },
  {
    title: "Billing",
    items: [
      { href: "/billing", label: "Billing" },
      { href: "/billing/collections", label: "Collections" },
      { href: "/billing/reports", label: "Reports" },
      { href: "/billing/lab", label: "Lab collections" },
      { href: "/pharmacy/prescriptions", label: "Pharmacy bills" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/leave", label: "Leave" },
      { href: "/helpdesk", label: "Helpdesk" },
    ],
  },
];

const receptionistNav: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/staff", label: "Staff" },
      { href: "/patients", label: "Patients" },
      { href: "/appointments", label: "Appointments" },
      { href: "/queue", label: "OPD queue" },
      { href: "/wards", label: "Wards" },
    ],
  },
  {
    title: "Billing",
    items: [
      { href: "/billing", label: "Billing" },
      { href: "/billing/collections", label: "Collections" },
      { href: "/billing/reports", label: "Reports" },
      { href: "/billing/lab", label: "Lab collections" },
      { href: "/pharmacy/prescriptions", label: "Pharmacy bills" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/leave", label: "Leave" },
      { href: "/helpdesk", label: "Helpdesk" },
    ],
  },
];

const accountantNav: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/staff", label: "Staff" },
      { href: "/patients", label: "Patients" },
      { href: "/wards", label: "Wards" },
    ],
  },
  {
    title: "Billing",
    items: [
      { href: "/billing", label: "Billing" },
      { href: "/billing/collections", label: "Collections" },
      { href: "/billing/reports", label: "Reports" },
      { href: "/billing/lab", label: "Lab collections" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/leave", label: "Leave" },
      { href: "/helpdesk", label: "Helpdesk" },
    ],
  },
];

const unaffiliatedNav: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/join", label: "Join a hospital" },
      { href: "/helpdesk", label: "Helpdesk" },
    ],
  },
];

const helpdeskNav: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/helpdesk", label: "Helpdesk" },
      { href: "/helpdesk/canned-replies", label: "Canned replies" },
      { href: "/medicine-catalog", label: "Medicine catalog" },
    ],
  },
];

const softwareAdminNav: NavSection[] = [
  {
    items: [{ href: "/", label: "Dashboard" }],
  },
  {
    title: "Platform",
    items: [
      { href: "/platform/hospitals", label: "Hospital list" },
      { href: "/platform/hospitals/new", label: "Create hospital" },
      { href: "/platform/billing-settings", label: "Billing settings" },
      { href: "/platform/users", label: "All users" },
      { href: "/platform/join-requests", label: "Join requests" },
      { href: "/medicine-catalog", label: "Medicine catalog" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/helpdesk", label: "Helpdesk" },
      { href: "/helpdesk/canned-replies", label: "Canned replies" },
      { href: "/platform/helpdesk-team", label: "Helpdesk team" },
      { href: "/platform/audit-log", label: "Audit log" },
    ],
  },
];

const superAdminNav: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard" },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/hospital/users", label: "Hospital users" },
      { href: "/hospital/join-requests", label: "Join requests" },
      { href: "/hospital/settings", label: "Hospital settings" },
      { href: "/hospital/leaves", label: "Staff leave" },
      { href: "/hospital/subscription", label: "Subscription" },
      { href: "/drug-brands", label: "Medicine brands" },
      { href: "/hospital/audit-log", label: "Audit log" },
    ],
  },
  {
    title: "Clinical",
    items: [
      { href: "/queue", label: "OPD queue" },
      { href: "/appointments", label: "Appointments" },
      { href: "/patients", label: "Patients" },
      { href: "/wards", label: "Wards" },
      { href: "/staff", label: "Staff" },
      { href: "/certificates", label: "Certificates" },
    ],
  },
  {
    title: "Diagnostics",
    items: [
      { href: "/hospital/lab-prices", label: "Lab prices" },
      { href: "/lab", label: "Laboratory" },
    ],
  },
  {
    title: "Pharmacy",
    items: [
      { href: "/pharmacy/prescriptions", label: "Prescription billing" },
      { href: "/pharmacy", label: "Inventory" },
      { href: "/pharmacy/stock-in", label: "Stock in (GRN)" },
    ],
  },
  {
    title: "Billing",
    items: [
      { href: "/billing", label: "Billing" },
      { href: "/billing/collections", label: "Collections" },
      { href: "/billing/reports", label: "Reports" },
      { href: "/billing/lab", label: "Lab collections" },
    ],
  },
  {
    title: "Support",
    items: [{ href: "/helpdesk", label: "Helpdesk" }],
  },
];

const pharmacistNav: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/staff", label: "Staff" },
      { href: "/pharmacy/prescriptions", label: "Prescription billing" },
      { href: "/pharmacy", label: "Inventory" },
      { href: "/pharmacy/stock-in", label: "Stock in (GRN)" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/leave", label: "Leave" },
      { href: "/helpdesk", label: "Helpdesk" },
    ],
  },
];

const labTechNav: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/staff", label: "Staff" },
      { href: "/lab", label: "Laboratory" },
      { href: "/leave", label: "Leave" },
      { href: "/helpdesk", label: "Helpdesk" },
    ],
  },
];

const LAB_PATHS = ["/lab", "/billing/lab", "/hospital/lab-prices"];
const PHARMACY_PATHS = ["/pharmacy"];
const INVENTORY_PATHS = ["/pharmacy/stock-in"];
const WARD_PATHS = ["/wards"];

function isPharmacyNavHref(href: string) {
  return PHARMACY_PATHS.some((prefix) => href === prefix || href.startsWith(`${prefix}/`));
}

function isInventoryOnlyHref(href: string) {
  if (href === "/pharmacy") return true;
  return INVENTORY_PATHS.some((prefix) => href === prefix || href.startsWith(`${prefix}/`));
}

function filterNavByModules(
  nav: NavSection[],
  modules: {
    pharmacyEnabled: boolean;
    labEnabled: boolean;
    inventoryEnabled: boolean;
    wardsEnabled: boolean;
  },
) {
  return nav
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!modules.labEnabled && LAB_PATHS.some((prefix) => item.href === prefix || item.href.startsWith(`${prefix}/`))) {
          return false;
        }
        if (!modules.pharmacyEnabled && isPharmacyNavHref(item.href)) {
          return false;
        }
        if (modules.pharmacyEnabled && !modules.inventoryEnabled && isInventoryOnlyHref(item.href)) {
          return false;
        }
        if (
          !modules.wardsEnabled &&
          WARD_PATHS.some((prefix) => item.href === prefix || item.href.startsWith(`${prefix}/`))
        ) {
          return false;
        }
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export async function AppShell({
  title,
  children,
  dense = false,
}: {
  title: string;
  children: React.ReactNode;
  dense?: boolean;
}) {
  const user = await getCurrentUser();
  if (!user) {
    const jar = await cookies();
    if (jar.get(SESSION_COOKIE)?.value) jar.delete(SESSION_COOKIE);
    redirect("/login");
  }
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (
    user?.hospitalId &&
    !isPlatformRole(user.role) &&
    hospitalAccessBlocked(user.hospital) &&
    pathname &&
    !isExpiredTrialAllowedPath(pathname)
  ) {
    redirect(user.role === "SUPER_ADMIN" ? "/hospital/subscription" : "/subscribe");
  }
  const modules = {
    pharmacyEnabled: user?.hospital?.pharmacyEnabled ?? true,
    labEnabled: user?.hospital?.labEnabled ?? true,
    inventoryEnabled: user?.hospital?.inventoryEnabled ?? user?.hospital?.pharmacyEnabled ?? true,
    wardsEnabled: hospitalHasWardsModule(user?.hospital),
  };

  const view = await resolveViewContext(user);
  const useDoctorNav = view.canActAsDoctor && view.mode === "doctor";

  let nav: NavSection[] =
    user?.role === "SOFTWARE_ADMIN"
      ? softwareAdminNav
      : user?.role === "HELPDESK"
        ? helpdeskNav
        : user && !user.hospitalId && !isPlatformRole(user.role)
          ? unaffiliatedNav
          : useDoctorNav
            ? doctorNav
            : user?.role === "SUPER_ADMIN"
              ? superAdminNav
              : user?.role === "RECEPTIONIST"
                ? receptionistNav
                : user?.role === "ACCOUNTANT"
                  ? accountantNav
                  : user?.role === "NURSE"
                    ? isNurseReceptionist(user)
                      ? nurseReceptionistNav
                      : nurseNav
                    : user?.role === "LAB_TECH"
                      ? labTechNav
                      : user?.role === "PHARMACIST"
                        ? pharmacistNav
                        : user?.role === "DOCTOR"
                          ? doctorNav
                          : staffNav;

  if (user?.hospitalId && !isPlatformRole(user.role)) {
    nav = filterNavByModules(nav, modules);
  }

  const displayName = user
    ? useDoctorNav
      ? `Dr. ${[user.firstName, user.lastName].filter(Boolean).join(" ") || user.username}`
      : user.username
    : undefined;
  const roleLabel = useDoctorNav ? "Doctor" : user?.role.replace(/_/g, " ");

  return (
    <AppShellFrame
      title={title}
      brand={user?.role === "SOFTWARE_ADMIN" || user?.role === "HELPDESK" ? "SaaS console" : "Hospital ERP"}
      hospitalLabel={user?.hospital ? `${user.hospital.name} · ${user.hospital.code}` : undefined}
      userLabel={user && displayName ? `${displayName} · ${roleLabel}` : undefined}
      nav={nav}
      dense={dense}
      viewMode={view.canActAsDoctor ? view.mode : undefined}
    >
      {children}
    </AppShellFrame>
  );
}
