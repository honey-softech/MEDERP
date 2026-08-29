import { AppShellFrame, type NavSection } from "@/components/app-shell-frame";
import { getCurrentUser, isPlatformRole } from "@/lib/auth";
import { hospitalHasWardsModule } from "@/lib/subscription-tiers";
import { hospitalAccessBlocked, isExpiredTrialAllowedPath } from "@/lib/hospital-access";
import { headers } from "next/headers";
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
      { href: "/patients", label: "Patients" },
      { href: "/appointments", label: "Appointments" },
      { href: "/queue", label: "OPD queue" },
    ],
  },
  {
    title: "Hospital",
    items: [
      { href: "/staff", label: "Staff" },
      { href: "/wards", label: "Wards" },
      { href: "/billing", label: "Billing" },
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
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/helpdesk", label: "Helpdesk" },
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
      { href: "/hospital/settings", label: "Hospital branding" },
      { href: "/drug-brands", label: "Medicine brands" },
      { href: "/hospital/users", label: "Hospital users" },
      { href: "/hospital/subscription", label: "Subscription" },
      { href: "/hospital/join-requests", label: "Join requests" },
      { href: "/hospital/leaves", label: "Staff leave" },
      { href: "/hospital/audit-log", label: "Audit log" },
    ],
  },
  {
    title: "Clinical",
    items: [
      { href: "/nurse", label: "Nurse station" },
      { href: "/patients", label: "Patients" },
      { href: "/appointments", label: "Appointments" },
      { href: "/queue", label: "OPD queue" },
      { href: "/staff", label: "Staff" },
      { href: "/wards", label: "Wards" },
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

  let nav: NavSection[] =
    user?.role === "SOFTWARE_ADMIN"
      ? softwareAdminNav
      : user?.role === "HELPDESK"
        ? helpdeskNav
        : user && !user.hospitalId && !isPlatformRole(user.role)
          ? unaffiliatedNav
          : user?.role === "SUPER_ADMIN"
            ? superAdminNav
            : user?.role === "RECEPTIONIST"
              ? receptionistNav
              : user?.role === "ACCOUNTANT"
                ? accountantNav
                : user?.role === "NURSE"
                  ? nurseNav
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

  return (
    <AppShellFrame
      title={title}
      brand={user?.role === "SOFTWARE_ADMIN" || user?.role === "HELPDESK" ? "SaaS console" : "Hospital ERP"}
      hospitalLabel={user?.hospital ? `${user.hospital.name} · ${user.hospital.code}` : undefined}
      userLabel={user ? `${user.username} · ${user.role.replace(/_/g, " ")}` : undefined}
      nav={nav}
      dense={dense}
    >
      {children}
    </AppShellFrame>
  );
}
