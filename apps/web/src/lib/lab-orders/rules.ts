import { LAB_CARD_BRANDS, LAB_COLLECTION_METHODS } from "@/lib/lab-orders/types";

export function inHouseLabBlocked(fulfillment: string | null | undefined) {
  return fulfillment === "EXTERNAL";
}

export function canCollectSample(status: string) {
  return status === "PAID" || status === "SAMPLE_COLLECTED";
}

export function canSaveLabResults(status: string) {
  return status !== "AWAITING_PAYMENT" && status !== "CANCELLED";
}

export function requiresReportBeforeDone(reportFileName: string | null | undefined) {
  return !reportFileName;
}

export function canCollectLabPayment(input: {
  fulfillment: string | null | undefined;
  status: string;
  itemCount: number;
}): { ok: true } | { ok: false; error: string; status: number } {
  if (inHouseLabBlocked(input.fulfillment)) {
    return {
      ok: false,
      error: "This investigation is done outside. Attach the report on the visit instead of collecting here.",
      status: 409,
    };
  }
  if (input.status !== "AWAITING_PAYMENT") {
    return { ok: false, error: "This lab order is already collected or closed.", status: 409 };
  }
  if (input.itemCount === 0) {
    return { ok: false, error: "No tests on this order.", status: 400 };
  }
  return { ok: true };
}

export function validateLabCollectionPayment(input: {
  method: string;
  amount: number;
  due: number;
  cardBrand?: string;
}): { ok: true } | { ok: false; error: string; status: number } {
  if (input.due <= 0.05) return { ok: true };
  if (!(LAB_COLLECTION_METHODS as readonly string[]).includes(input.method) || !(input.amount > 0)) {
    return { ok: false, error: "Choose cash, card, or UPI and enter a valid amount.", status: 400 };
  }
  if (Math.abs(input.amount - input.due) > 0.05) {
    return {
      ok: false,
      error: `Collect the full lab amount of ₹${input.due.toFixed(2)} after discount or waiver.`,
      status: 400,
    };
  }
  if (input.method === "CARD" && !LAB_CARD_BRANDS.includes(input.cardBrand as (typeof LAB_CARD_BRANDS)[number])) {
    return { ok: false, error: "Choose a card type.", status: 400 };
  }
  return { ok: true };
}

export function canUploadLabReport(input: {
  role: string;
  fulfillment: string | null | undefined;
  status: string;
}): { ok: true } | { ok: false; error: string; status: number } {
  const external = input.fulfillment === "EXTERNAL";
  const allowed = external
    ? ["SUPER_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"].includes(input.role)
    : ["SUPER_ADMIN", "LAB_TECH"].includes(input.role);
  if (!allowed) {
    return { ok: false, error: "You cannot upload this report.", status: 403 };
  }
  if (external) {
    if (input.status === "CANCELLED") {
      return { ok: false, error: "This investigation was cancelled.", status: 409 };
    }
  } else if (input.status === "AWAITING_PAYMENT" || input.status === "CANCELLED") {
    return { ok: false, error: "Collect payment before uploading a report.", status: 409 };
  }
  if (input.status === "RESULTED" && input.role !== "SUPER_ADMIN") {
    return { ok: false, error: "This order is already marked done.", status: 409 };
  }
  return { ok: true };
}

export function canViewLabReport(input: {
  role: string;
  fulfillment: string | null | undefined;
  status: string;
}): { ok: true } | { ok: false; error: string; status: number } {
  const labView = ["DOCTOR", "NURSE"].includes(input.role);
  const labWork = ["SUPER_ADMIN", "LAB_TECH"].includes(input.role);
  const externalUpload = ["SUPER_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"].includes(input.role);
  const canView =
    labView || labWork || (input.fulfillment === "EXTERNAL" && externalUpload);
  if (!canView) {
    return { ok: false, error: "You cannot open this report.", status: 403 };
  }
  if (input.role === "LAB_TECH" && input.status === "RESULTED") {
    return {
      ok: false,
      error: "This report is on the patient record for the doctor and nurse.",
      status: 403,
    };
  }
  return { ok: true };
}
