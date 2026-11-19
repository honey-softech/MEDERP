import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getPageTour,
  matchingPageTourIds,
  pageTourCatalog,
  pageTourSeenKey,
  selectPageTourSteps,
} from "@/lib/page-tours";
import { getTourSteps, type TourRole } from "@/lib/tour-steps";

const PATHS: Record<string, string | null> = {
  "/": null,
  "/queue": "queue",
  "/appointments": "appointments",
  "/appointments/new": "book-visit",
  "/appointments/abc": "visit",
  "/appointments/abc/vitals": "vitals",
  "/appointments/abc/summary": null,
  "/appointments/abc/investigations": null,
  "/patients": "patients",
  "/patients/new": null,
  "/patients/abc": "patient",
  "/patients/abc/edit": null,
  "/billing": "billing",
  "/billing/new": null,
  "/billing/collections": "collections",
  "/billing/collect/abc": null,
  "/nurse": "nurse",
  "/wards": "wards",
  "/wards/admit": null,
  "/hospital/users": "hospital-users",
  "/hospital/users/abc": null,
  "/hospital/settings": "hospital-settings",
  "/hospital/settings/doctor-profile": null,
};

describe("page tours", () => {
  it("matches one tour on the daily pages and none on the neighbouring routes", () => {
    for (const [pathname, id] of Object.entries(PATHS)) {
      const matches = matchingPageTourIds(pathname);
      expect(matches, pathname).toEqual(id ? [id] : []);
    }
  });

  it("gives every step a title and description, and ends by offering the menu", () => {
    for (const tour of pageTourCatalog()) {
      expect(tour.steps.length).toBeGreaterThan(1);
      expect(tour.steps.at(-1)?.offerMenu).toBe(true);
      expect(tour.steps.slice(0, -1).every((step) => step.offerMenu === false)).toBe(true);
      for (const step of tour.steps) {
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.description.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("drops anchors that are not on the page and keeps the closing step", () => {
    const tour = getPageTour("RECEPTIONIST", "/queue");
    expect(tour?.id).toBe("queue");
    const visible = selectPageTourSteps(tour?.steps ?? [], (anchor) => anchor === "page:queue-day");
    expect(visible.map((step) => step.anchor ?? "close")).toEqual(["page:queue-day", "close"]);
    const none = selectPageTourSteps(tour?.steps ?? [], () => false);
    expect(none.some((step) => step.anchor)).toBe(false);
  });

  it("uses the consult copy for a doctor and the front-desk copy for an admin", () => {
    const doctor = getPageTour("DOCTOR", "/appointments/apt-1");
    const admin = getPageTour("SUPER_ADMIN", "/appointments/apt-1");
    expect(doctor?.steps.some((step) => step.title === "The consult")).toBe(true);
    expect(admin?.steps.some((step) => step.title === "The consult")).toBe(false);
    expect(admin?.steps.some((step) => step.title === "Fee, vitals, and check-in")).toBe(true);
  });

  it("keeps hospital setup on the admin tour and the nurse station on the nurse tour", () => {
    expect(getPageTour("RECEPTIONIST", "/hospital/users")).toBeNull();
    expect(getPageTour("NURSE", "/hospital/settings")).toBeNull();
    expect(getPageTour("DOCTOR", "/nurse")).toBeNull();
    expect(getPageTour("SUPER_ADMIN", "/nurse")).toBeNull();
    expect(getPageTour("NURSE", "/nurse")?.steps.some((step) => step.anchor === "page:nurse-pending")).toBe(true);
    expect(getPageTour("NURSE_RECEPTIONIST", "/billing/collections")?.id).toBe("collections");
    expect(getPageTour("SUPER_ADMIN", "/hospital/settings")?.id).toBe("hospital-settings");
    expect(getPageTour("ACCOUNTANT", "/billing")).toBeNull();
  });

  it("marks every anchored step in the app screens", () => {
    const source = readTsx(path.resolve(__dirname, ".."));
    for (const tour of pageTourCatalog()) {
      for (const step of tour.steps) {
        if (!step.anchor) continue;
        expect(source, `${tour.id} ${step.anchor}`).toContain(step.anchor);
      }
    }
  });

  it("scopes the seen flag to one person and one page", () => {
    expect(pageTourSeenKey("user-1", "queue")).toBe("mederp-page-tour-seen:user-1:queue");
    expect(pageTourSeenKey("user-1", "queue")).not.toBe(pageTourSeenKey("user-2", "queue"));
    expect(pageTourSeenKey("user-1", "queue")).not.toBe(pageTourSeenKey("user-1", "billing"));
  });
});

function readTsx(dir: string): string {
  let text = "";
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) text += readTsx(full);
    else if (entry.name.endsWith(".tsx")) text += readFileSync(full, "utf8");
  }
  return text;
}

describe("menu tour", () => {
  function hrefsFor(role: TourRole, hrefs: string[]) {
    return getTourSteps(role, hrefs, true)
      .map((step) => step.href)
      .filter((href): href is string => Boolean(href));
  }

  it("walks the admin links that were missing from the sidebar tour", () => {
    const hrefs = hrefsFor("SUPER_ADMIN", [
      "/",
      "/queue",
      "/appointments",
      "/patients",
      "/wards",
      "/certificates",
      "/billing",
      "/billing/collections",
      "/billing/reports",
      "/staff",
      "/hospital/users",
      "/hospital/join-requests",
      "/hospital/leaves",
      "/hospital/timesheets",
      "/hospital/settings",
      "/hospital/subscription",
      "/hospital/audit-log",
      "/helpdesk",
    ]);
    expect(hrefs).toEqual(expect.arrayContaining(["/wards", "/certificates", "/billing/reports", "/helpdesk"]));
    expect(hrefs).not.toContain("/leave");
    expect(hrefs).not.toContain("/timesheet");
  });

  it("walks the doctor, reception, and nurse links when they are in that menu", () => {
    expect(
      hrefsFor("DOCTOR", ["/", "/queue", "/appointments", "/patients", "/wards", "/staff", "/billing", "/certificates", "/leave", "/timesheet", "/helpdesk"]),
    ).toEqual(expect.arrayContaining(["/wards", "/staff", "/billing", "/leave", "/timesheet", "/helpdesk"]));
    expect(
      hrefsFor("RECEPTIONIST", [
        "/",
        "/staff",
        "/patients",
        "/appointments",
        "/queue",
        "/wards",
        "/billing",
        "/billing/collections",
        "/billing/reports",
        "/billing/lab",
        "/pharmacy/prescriptions",
        "/leave",
        "/timesheet",
        "/helpdesk",
      ]),
    ).toEqual(expect.arrayContaining(["/wards", "/billing/reports", "/billing/lab", "/pharmacy/prescriptions", "/helpdesk"]));
    expect(
      hrefsFor("NURSE", [
        "/",
        "/nurse",
        "/queue",
        "/appointments",
        "/patients",
        "/wards",
        "/certificates",
        "/staff",
        "/billing",
        "/billing/collections",
        "/billing/reports",
        "/leave",
        "/timesheet",
        "/helpdesk",
      ]),
    ).toEqual(expect.arrayContaining(["/appointments", "/certificates", "/billing", "/billing/reports", "/leave"]));
    expect(
      hrefsFor("NURSE_RECEPTIONIST", [
        "/",
        "/nurse",
        "/queue",
        "/appointments",
        "/patients",
        "/wards",
        "/billing",
        "/billing/lab",
        "/pharmacy/prescriptions",
        "/helpdesk",
      ]),
    ).toEqual(expect.arrayContaining(["/billing/lab", "/pharmacy/prescriptions"]));
  });

  it("does not point at the same sidebar link twice", () => {
    const hrefs = [
      "/",
      "/queue",
      "/appointments",
      "/patients",
      "/wards",
      "/certificates",
      "/staff",
      "/billing",
      "/billing/collections",
      "/billing/reports",
      "/billing/lab",
      "/pharmacy/prescriptions",
      "/nurse",
      "/leave",
      "/timesheet",
      "/helpdesk",
      "/hospital/users",
      "/hospital/join-requests",
      "/hospital/leaves",
      "/hospital/timesheets",
      "/hospital/settings",
      "/hospital/subscription",
      "/hospital/audit-log",
    ];
    const roles: TourRole[] = ["SUPER_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE", "NURSE_RECEPTIONIST"];
    for (const role of roles) {
      const steps = hrefsFor(role, hrefs);
      expect(new Set(steps).size, role).toBe(steps.length);
    }
  });
});
