import { NextResponse } from "next/server";
import type {
  AdmissionType,
  AppRole,
  BedStatus,
  BedType,
  DischargeType,
  Gender,
  PaymentMethod,
  Prisma,
  WardGenderPolicy,
  WardType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ageYears, invoiceStatusFromTotals, nextCounter, nextInvoiceNo, pad, requireHospitalPage } from "@/lib/front-desk";
import { hospitalHasWardsModule } from "@/lib/subscription-tiers";
import { redirect } from "next/navigation";

export const WARD_VIEW_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST", "DOCTOR", "NURSE", "ACCOUNTANT"];
export const WARD_MASTER_ROLES: AppRole[] = ["SUPER_ADMIN"];
export const WARD_ADMIT_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST"];
export const WARD_TRANSFER_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST", "NURSE"];
export const WARD_HOUSEKEEPING_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST", "NURSE"];
export const WARD_DISCHARGE_ADVICE_ROLES: AppRole[] = ["SUPER_ADMIN", "DOCTOR"];
export const WARD_BILLING_ROLES: AppRole[] = ["SUPER_ADMIN", "RECEPTIONIST", "ACCOUNTANT"];

export const ACTIVE_ADMISSION_STATUSES = ["ADMITTED", "DISCHARGE_ADVISED"] as const;

export class WardError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function wardErrorResponse(error: unknown) {
  if (error instanceof WardError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Ward action failed." }, { status: 500 });
}

export async function assertWardsModuleEnabled(hospitalId: string) {
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { subscriptionTier: true },
  });
  if (!hospitalHasWardsModule(hospital)) {
    throw new WardError(
      "Inpatient wards are included on Professional and Enterprise plans only. Upgrade your subscription to use wards.",
      403,
    );
  }
}

export async function requireWardsPage() {
  const user = await requireHospitalPage();
  if (!hospitalHasWardsModule(user.hospital)) {
    redirect("/hospital/subscription");
  }
  return user;
}

const WARD_TYPES: WardType[] = [
  "GENERAL",
  "PRIVATE",
  "SEMI_PRIVATE",
  "ICU",
  "ICCU",
  "NICU",
  "PICU",
  "ISOLATION",
  "LABOUR",
  "DAY_CARE",
  "CASUALTY",
];
const GENDER_POLICIES: WardGenderPolicy[] = ["MALE", "FEMALE", "MIXED", "PAEDIATRIC"];
const BED_TYPES: BedType[] = ["GENERAL", "PRIVATE", "SEMI_PRIVATE", "ICU", "VENTILATOR"];
const ADMISSION_TYPES: AdmissionType[] = ["ELECTIVE", "EMERGENCY", "DAY_CARE"];
const DISCHARGE_TYPES: DischargeType[] = ["ROUTINE", "LAMA", "ABSCONDED", "DEATH", "TRANSFER_OUT"];
const PAY_METHODS: PaymentMethod[] = ["CASH", "CARD", "UPI", "INSURANCE"];

type Tx = Prisma.TransactionClient;

const DEFAULT_WARDS: Array<{
  code: string;
  name: string;
  type: WardType;
  genderPolicy: WardGenderPolicy;
  dailyRate: number;
  nursingRate: number;
  bedCount: number;
  bedType: BedType;
  capacityLabel: string;
}> = [
  {
    code: "GM",
    name: "General Male",
    type: "GENERAL",
    genderPolicy: "MALE",
    dailyRate: 1500,
    nursingRate: 300,
    bedCount: 10,
    bedType: "GENERAL",
    capacityLabel: "General male beds",
  },
  {
    code: "GF",
    name: "General Female",
    type: "GENERAL",
    genderPolicy: "FEMALE",
    dailyRate: 1500,
    nursingRate: 300,
    bedCount: 10,
    bedType: "GENERAL",
    capacityLabel: "General female beds",
  },
  {
    code: "SP",
    name: "Semi Private",
    type: "SEMI_PRIVATE",
    genderPolicy: "MIXED",
    dailyRate: 2500,
    nursingRate: 400,
    bedCount: 6,
    bedType: "SEMI_PRIVATE",
    capacityLabel: "Semi-private rooms",
  },
  {
    code: "PR",
    name: "Private",
    type: "PRIVATE",
    genderPolicy: "MIXED",
    dailyRate: 4000,
    nursingRate: 500,
    bedCount: 4,
    bedType: "PRIVATE",
    capacityLabel: "Private rooms",
  },
  {
    code: "ICU",
    name: "ICU",
    type: "ICU",
    genderPolicy: "MIXED",
    dailyRate: 8000,
    nursingRate: 1200,
    bedCount: 4,
    bedType: "ICU",
    capacityLabel: "ICU beds",
  },
];

export type StandardWardCode = (typeof DEFAULT_WARDS)[number]["code"];
export const STANDARD_WARD_CODES = DEFAULT_WARDS.map((ward) => ward.code) as StandardWardCode[];

export type WardCapacityRow = {
  code: StandardWardCode;
  name: string;
  capacityLabel: string;
  wardId: string | null;
  type: WardType;
  total: number;
  available: number;
  occupied: number;
  housekeeping: number;
};

export function isStandardWardCode(value: string): value is StandardWardCode {
  return (STANDARD_WARD_CODES as readonly string[]).includes(value);
}

export function isWardType(value: string): value is WardType {
  return WARD_TYPES.includes(value as WardType);
}
export function isGenderPolicy(value: string): value is WardGenderPolicy {
  return GENDER_POLICIES.includes(value as WardGenderPolicy);
}
export function isBedType(value: string): value is BedType {
  return BED_TYPES.includes(value as BedType);
}
export function isAdmissionType(value: string): value is AdmissionType {
  return ADMISSION_TYPES.includes(value as AdmissionType);
}
export function isDischargeType(value: string): value is DischargeType {
  return DISCHARGE_TYPES.includes(value as DischargeType);
}

export async function nextIpNumber(hospitalId: string, hospitalCode: string) {
  const year = new Date().getFullYear();
  const n = await nextCounter(hospitalId, `IP-${year}`);
  return `IP-${hospitalCode}-${year}-${pad(n)}`;
}

export function stayDays(admittedAt: Date, dischargedAt = new Date()) {
  const start = new Date(admittedAt);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dischargedAt);
  end.setHours(0, 0, 0, 0);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, days + 1);
}

export function bedMatchesPatient(ward: { genderPolicy: WardGenderPolicy }, patient: { gender: Gender; dateOfBirth: Date }) {
  if (ward.genderPolicy === "MIXED") return true;
  if (ward.genderPolicy === "MALE") return patient.gender === "MALE";
  if (ward.genderPolicy === "FEMALE") return patient.gender === "FEMALE";
  return ageYears(patient.dateOfBirth) < 16;
}

async function defaultDepartmentId(hospitalId: string) {
  const department =
    (await prisma.department.findFirst({ where: { hospitalId, code: "GEN" } })) ??
    (await prisma.department.findFirst({ where: { hospitalId }, orderBy: { name: "asc" } }));
  return department?.id ?? null;
}

export async function seedHospitalWards(hospitalId: string) {
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { subscriptionTier: true },
  });
  if (!hospitalHasWardsModule(hospital)) return;

  const existing = await prisma.ward.count({ where: { hospitalId } });
  if (existing > 0) {
    await ensureStandardWards(hospitalId);
    return;
  }

  const departmentId = await defaultDepartmentId(hospitalId);
  if (!departmentId) return;

  for (const ward of DEFAULT_WARDS) {
    const created = await prisma.ward.create({
      data: {
        hospitalId,
        departmentId,
        name: ward.name,
        code: ward.code,
        type: ward.type,
        genderPolicy: ward.genderPolicy,
        dailyRate: ward.dailyRate,
        nursingRate: ward.nursingRate,
      },
    });
    await prisma.bed.createMany({
      data: Array.from({ length: ward.bedCount }, (_, index) => ({
        hospitalId,
        wardId: created.id,
        number: `${ward.code}-${String(index + 1).padStart(2, "0")}`,
        type: ward.bedType,
        status: "AVAILABLE" as const,
      })),
    });
  }
}

/** Creates any missing standard wards (GM/GF/SP/PR/ICU) with zero beds. */
export async function ensureStandardWards(hospitalId: string) {
  const departmentId = await defaultDepartmentId(hospitalId);
  if (!departmentId) return;

  const existing = await prisma.ward.findMany({
    where: { hospitalId, code: { in: [...STANDARD_WARD_CODES] } },
    select: { code: true },
  });
  const have = new Set(existing.map((row) => row.code));

  for (const ward of DEFAULT_WARDS) {
    if (have.has(ward.code)) continue;
    await prisma.ward.create({
      data: {
        hospitalId,
        departmentId,
        name: ward.name,
        code: ward.code,
        type: ward.type,
        genderPolicy: ward.genderPolicy,
        dailyRate: ward.dailyRate,
        nursingRate: ward.nursingRate,
      },
    });
  }
}

export async function listWardCapacity(hospitalId: string): Promise<WardCapacityRow[]> {
  await seedHospitalWards(hospitalId);
  const wards = await prisma.ward.findMany({
    where: { hospitalId, code: { in: [...STANDARD_WARD_CODES] } },
    include: {
      beds: {
        where: { isActive: true },
        select: { status: true, isOccupied: true },
      },
    },
  });
  const byCode = new Map(wards.map((ward) => [ward.code, ward]));

  return DEFAULT_WARDS.map((def) => {
    const ward = byCode.get(def.code);
    const beds = ward?.beds ?? [];
    const occupied = beds.filter((bed) => bed.status === "OCCUPIED" || bed.isOccupied).length;
    const available = beds.filter((bed) => bed.status === "AVAILABLE" && !bed.isOccupied).length;
    const housekeeping = beds.filter((bed) => bed.status === "HOUSEKEEPING").length;
    return {
      code: def.code,
      name: ward?.name ?? def.name,
      capacityLabel: def.capacityLabel,
      wardId: ward?.id ?? null,
      type: (ward?.type ?? def.type) as WardType,
      total: beds.length,
      available,
      occupied,
      housekeeping,
    };
  });
}

/**
 * Sets how many active beds/rooms each standard ward should have.
 * Increases by reactivating inactive beds then creating new ones.
 * Decreases by deactivating empty AVAILABLE beds only (never removes occupied).
 */
export async function setStandardWardCapacity(params: {
  hospitalId: string;
  counts: Partial<Record<StandardWardCode, number>>;
}) {
  await seedHospitalWards(params.hospitalId);
  const results: Array<{ code: StandardWardCode; total: number; added: number; deactivated: number }> = [];

  for (const def of DEFAULT_WARDS) {
    if (params.counts[def.code] == null) continue;
    const target = Math.min(80, Math.max(0, Math.trunc(Number(params.counts[def.code]))));
    const ward = await prisma.ward.findFirst({
      where: { hospitalId: params.hospitalId, code: def.code },
    });
    if (!ward) throw new WardError(`Standard ward ${def.code} is missing.`, 404);

    const beds = await prisma.bed.findMany({
      where: { wardId: ward.id },
      orderBy: { number: "asc" },
    });
    const active = beds.filter((bed) => bed.isActive);
    let added = 0;
    let deactivated = 0;

    if (target > active.length) {
      const need = target - active.length;
      const inactive = beds.filter(
        (bed) => !bed.isActive && bed.status !== "OCCUPIED" && !bed.isOccupied,
      );
      const revive = inactive.slice(0, need);
      if (revive.length > 0) {
        await prisma.bed.updateMany({
          where: { id: { in: revive.map((bed) => bed.id) } },
          data: { isActive: true, status: "AVAILABLE", isOccupied: false },
        });
        added += revive.length;
      }
      let stillNeed = need - revive.length;
      while (stillNeed > 0) {
        const chunk = Math.min(40, stillNeed);
        const created = await addBeds({
          hospitalId: params.hospitalId,
          wardId: ward.id,
          count: chunk,
          type: def.bedType,
          room: def.type === "PRIVATE" || def.type === "SEMI_PRIVATE" ? def.code : null,
        });
        added += created;
        stillNeed -= created;
        if (created === 0) break;
      }
    } else if (target < active.length) {
      const excess = active.length - target;
      const removable = active
        .filter((bed) => bed.status === "AVAILABLE" && !bed.isOccupied)
        .slice(-excess);
      if (removable.length < excess) {
        const stuck = excess - removable.length;
        throw new WardError(
          `${def.name}: cannot reduce to ${target} — ${stuck} bed(s) are occupied or not free. Discharge or free them first.`,
        );
      }
      await prisma.bed.updateMany({
        where: { id: { in: removable.map((bed) => bed.id) } },
        data: { isActive: false, status: "BLOCKED", isOccupied: false },
      });
      deactivated = removable.length;
    }

    const total = await prisma.bed.count({ where: { wardId: ward.id, isActive: true } });
    results.push({ code: def.code, total, added, deactivated });
  }

  return results;
}

async function lockBed(tx: Tx, bedId: string) {
  await tx.$queryRaw`SELECT id FROM "Bed" WHERE id = ${bedId} FOR UPDATE`;
}

function occupyBedData() {
  return { status: "OCCUPIED" as const, isOccupied: true };
}

function vacateBedData(next: Extract<BedStatus, "HOUSEKEEPING" | "AVAILABLE">) {
  return { status: next, isOccupied: false };
}

export async function createWard(params: {
  hospitalId: string;
  departmentId: string;
  name: string;
  code: string;
  type: WardType;
  genderPolicy: WardGenderPolicy;
  floor?: string | null;
  dailyRate: number;
  nursingRate: number;
  notes?: string | null;
}) {
  const department = await prisma.department.findFirst({
    where: { id: params.departmentId, hospitalId: params.hospitalId },
  });
  if (!department) throw new WardError("Department must belong to this hospital.");

  const code = params.code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,12}$/.test(code)) throw new WardError("Ward code must be 1–12 letters, numbers, or dashes.");

  try {
    return await prisma.ward.create({
      data: {
        hospitalId: params.hospitalId,
        departmentId: department.id,
        name: params.name.trim(),
        code,
        type: params.type,
        genderPolicy: params.genderPolicy,
        floor: params.floor?.trim() || null,
        dailyRate: params.dailyRate,
        nursingRate: params.nursingRate,
        notes: params.notes?.trim() || null,
      },
    });
  } catch {
    throw new WardError("A ward with that code already exists.", 409);
  }
}

export async function updateWard(params: {
  hospitalId: string;
  wardId: string;
  name?: string;
  departmentId?: string;
  type?: WardType;
  genderPolicy?: WardGenderPolicy;
  floor?: string | null;
  dailyRate?: number;
  nursingRate?: number;
  isActive?: boolean;
  notes?: string | null;
}) {
  const ward = await prisma.ward.findFirst({ where: { id: params.wardId, hospitalId: params.hospitalId } });
  if (!ward) throw new WardError("Ward not found.", 404);
  if (params.departmentId) {
    const department = await prisma.department.findFirst({
      where: { id: params.departmentId, hospitalId: params.hospitalId },
    });
    if (!department) throw new WardError("Department must belong to this hospital.");
  }
  return prisma.ward.update({
    where: { id: ward.id },
    data: {
      ...(params.name ? { name: params.name.trim() } : {}),
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.genderPolicy ? { genderPolicy: params.genderPolicy } : {}),
      ...(params.floor !== undefined ? { floor: params.floor?.trim() || null } : {}),
      ...(params.dailyRate != null ? { dailyRate: params.dailyRate } : {}),
      ...(params.nursingRate != null ? { nursingRate: params.nursingRate } : {}),
      ...(params.isActive != null ? { isActive: params.isActive } : {}),
      ...(params.notes !== undefined ? { notes: params.notes?.trim() || null } : {}),
    },
  });
}

export async function addBeds(params: {
  hospitalId: string;
  wardId: string;
  count: number;
  startNumber?: number;
  prefix?: string | null;
  type?: BedType;
  room?: string | null;
}) {
  const ward = await prisma.ward.findFirst({ where: { id: params.wardId, hospitalId: params.hospitalId } });
  if (!ward) throw new WardError("Ward not found.", 404);
  const count = Math.min(40, Math.max(1, Math.trunc(params.count)));
  const existing = await prisma.bed.findMany({
    where: { wardId: ward.id },
    select: { number: true },
  });
  const taken = new Set(existing.map((row) => row.number.toLowerCase()));
  const prefix = (params.prefix?.trim() || ward.code).toUpperCase();
  let next = params.startNumber ?? existing.length + 1;
  const rows: { hospitalId: string; wardId: string; number: string; type: BedType; room: string | null }[] = [];
  while (rows.length < count && next < 500) {
    const number = `${prefix}-${String(next).padStart(2, "0")}`;
    next += 1;
    if (taken.has(number.toLowerCase())) continue;
    rows.push({
      hospitalId: params.hospitalId,
      wardId: ward.id,
      number,
      type: params.type ?? "GENERAL",
      room: params.room?.trim() || null,
    });
  }
  if (rows.length === 0) throw new WardError("Could not allocate unique bed numbers.");
  await prisma.bed.createMany({ data: rows });
  return rows.length;
}

export async function updateBedStatus(params: {
  hospitalId: string;
  bedId: string;
  action: "ready" | "maintenance" | "block" | "unblock";
}) {
  return prisma.$transaction(async (tx) => {
    await lockBed(tx, params.bedId);
    const bed = await tx.bed.findFirst({
      where: { id: params.bedId, hospitalId: params.hospitalId },
    });
    if (!bed) throw new WardError("Bed not found.", 404);
    if (bed.status === "OCCUPIED" || bed.isOccupied) {
      throw new WardError("Vacate the patient before changing this bed.");
    }
    if (params.action === "ready") {
      if (!["HOUSEKEEPING", "MAINTENANCE", "BLOCKED", "RESERVED"].includes(bed.status)) {
        throw new WardError("This bed is already available.");
      }
      return tx.bed.update({ where: { id: bed.id }, data: { status: "AVAILABLE", isOccupied: false, isActive: true } });
    }
    if (params.action === "maintenance") {
      if (bed.status !== "AVAILABLE" && bed.status !== "HOUSEKEEPING") {
        throw new WardError("Only empty beds can be sent to maintenance.");
      }
      return tx.bed.update({ where: { id: bed.id }, data: { status: "MAINTENANCE", isOccupied: false } });
    }
    if (params.action === "block") {
      if (bed.status !== "AVAILABLE") throw new WardError("Only available beds can be blocked.");
      return tx.bed.update({ where: { id: bed.id }, data: { status: "BLOCKED", isOccupied: false, isActive: false } });
    }
    if (bed.status !== "BLOCKED" && bed.status !== "MAINTENANCE") {
      throw new WardError("This bed is not blocked.");
    }
    return tx.bed.update({ where: { id: bed.id }, data: { status: "AVAILABLE", isOccupied: false, isActive: true } });
  });
}

async function requireAssignableBed(
  tx: Tx,
  hospitalId: string,
  bedId: string,
  patient: { gender: Gender; dateOfBirth: Date },
) {
  await lockBed(tx, bedId);
  const bed = await tx.bed.findFirst({
    where: { id: bedId, hospitalId, isActive: true },
    include: { ward: true },
  });
  if (!bed) throw new WardError("Bed not found.", 404);
  if (!bed.ward.isActive) throw new WardError("This ward is inactive.");
  if (bed.status !== "AVAILABLE" && bed.status !== "RESERVED") {
    throw new WardError("That bed is not available.");
  }
  if (bed.isOccupied) throw new WardError("That bed is already occupied.");
  if (!bedMatchesPatient(bed.ward, patient)) {
    throw new WardError(
      `Bed ${bed.number} is in a ${bed.ward.genderPolicy.toLowerCase()} ward and does not match this patient.`,
    );
  }
  const occupant = await tx.admission.findFirst({
    where: { bedId: bed.id, status: { in: [...ACTIVE_ADMISSION_STATUSES] } },
  });
  if (occupant) throw new WardError("That bed already has an active admission.");
  return bed;
}

export async function admitPatient(params: {
  hospitalId: string;
  hospitalCode: string;
  patientId: string;
  bedId: string;
  type: AdmissionType;
  diagnosis?: string | null;
  notes?: string | null;
  attendantName?: string | null;
  attendantPhone?: string | null;
  admittingDoctorId?: string | null;
  attendingDoctorId?: string | null;
  departmentId?: string | null;
  sourceAppointmentId?: string | null;
  expectedDischargeAt?: Date | null;
  advanceAmount?: number;
  advanceMethod?: PaymentMethod | null;
  receivedByUserId?: string | null;
}) {
  const patient = await prisma.patient.findFirst({
    where: { id: params.patientId, hospitalId: params.hospitalId, mergedIntoId: null },
  });
  if (!patient) throw new WardError("Patient not found.", 404);

  const existing = await prisma.admission.findFirst({
    where: { patientId: patient.id, status: { in: [...ACTIVE_ADMISSION_STATUSES] } },
  });
  if (existing) throw new WardError("This patient already has an active admission.", 409);

  const doctorIds = [params.admittingDoctorId, params.attendingDoctorId].filter(Boolean) as string[];
  if (doctorIds.length) {
    const doctors = await prisma.staff.findMany({
      where: { id: { in: doctorIds }, hospitalId: params.hospitalId, role: "DOCTOR", isActive: true },
    });
    if (doctors.length !== new Set(doctorIds).size) {
      throw new WardError("Admitting or attending doctor is not valid for this hospital.");
    }
  }

  if (params.departmentId) {
    const department = await prisma.department.findFirst({
      where: { id: params.departmentId, hospitalId: params.hospitalId },
    });
    if (!department) throw new WardError("Department must belong to this hospital.");
  }

  if (params.sourceAppointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: params.sourceAppointmentId, hospitalId: params.hospitalId, patientId: patient.id },
    });
    if (!appointment) throw new WardError("Linked visit was not found for this patient.");
  }

  const advanceAmount = Number(params.advanceAmount ?? 0);
  if (advanceAmount > 0 && (!params.advanceMethod || !PAY_METHODS.includes(params.advanceMethod))) {
    throw new WardError("Choose a valid method for the admission advance.");
  }

  const ipNumber = await nextIpNumber(params.hospitalId, params.hospitalCode);

  return prisma.$transaction(async (tx) => {
    const bed = await requireAssignableBed(tx, params.hospitalId, params.bedId, patient);
    const admission = await tx.admission.create({
      data: {
        hospitalId: params.hospitalId,
        ipNumber,
        patientId: patient.id,
        bedId: bed.id,
        departmentId: params.departmentId || bed.ward.departmentId,
        admittingDoctorId: params.admittingDoctorId || null,
        attendingDoctorId: params.attendingDoctorId || params.admittingDoctorId || null,
        sourceAppointmentId: params.sourceAppointmentId || null,
        type: params.type,
        diagnosis: params.diagnosis?.trim() || null,
        notes: params.notes?.trim() || null,
        attendantName: params.attendantName?.trim() || null,
        attendantPhone: params.attendantPhone?.trim() || null,
        expectedDischargeAt: params.expectedDischargeAt,
      },
    });
    await tx.bed.update({ where: { id: bed.id }, data: occupyBedData() });
    if (advanceAmount > 0 && params.advanceMethod) {
      await tx.payment.create({
        data: {
          hospitalId: params.hospitalId,
          patientId: patient.id,
          admissionId: admission.id,
          kind: "ADVANCE",
          method: params.advanceMethod,
          amount: advanceAmount,
          notes: `Advance for ${ipNumber}`,
          receivedByUserId: params.receivedByUserId ?? null,
        },
      });
      await tx.patient.update({
        where: { id: patient.id },
        data: { advanceBalance: { increment: advanceAmount } },
      });
    }
    return tx.admission.findUniqueOrThrow({
      where: { id: admission.id },
      include: {
        patient: true,
        bed: { include: { ward: true } },
        admittingDoctor: { include: { appUser: { select: { username: true } } } },
      },
    });
  });
}

export async function transferAdmission(params: {
  hospitalId: string;
  admissionId: string;
  toBedId: string;
  reason?: string | null;
  transferredByUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const admission = await tx.admission.findFirst({
      where: { id: params.admissionId, hospitalId: params.hospitalId, status: { in: [...ACTIVE_ADMISSION_STATUSES] } },
      include: { patient: true, bed: true },
    });
    if (!admission) throw new WardError("Active admission not found.", 404);
    if (admission.bedId === params.toBedId) throw new WardError("Patient is already on that bed.");

    const toBed = await requireAssignableBed(tx, params.hospitalId, params.toBedId, admission.patient);
    await lockBed(tx, admission.bedId);

    await tx.bedTransfer.create({
      data: {
        hospitalId: params.hospitalId,
        admissionId: admission.id,
        fromBedId: admission.bedId,
        toBedId: toBed.id,
        reason: params.reason?.trim() || null,
        transferredByUserId: params.transferredByUserId ?? null,
      },
    });
    await tx.admission.update({
      where: { id: admission.id },
      data: { bedId: toBed.id, departmentId: toBed.ward.departmentId },
    });
    await tx.bed.update({ where: { id: toBed.id }, data: occupyBedData() });
    await tx.bed.update({ where: { id: admission.bedId }, data: vacateBedData("HOUSEKEEPING") });
    return admission.id;
  });
}

export async function adviseDischarge(params: {
  hospitalId: string;
  admissionId: string;
  notes?: string | null;
}) {
  const admission = await prisma.admission.findFirst({
    where: { id: params.admissionId, hospitalId: params.hospitalId, status: "ADMITTED" },
  });
  if (!admission) throw new WardError("Only an admitted stay can be marked ready for discharge.", 404);
  return prisma.admission.update({
    where: { id: admission.id },
    data: {
      status: "DISCHARGE_ADVISED",
      dischargeAdviceAt: new Date(),
      dischargeNotes: params.notes?.trim() || admission.dischargeNotes,
    },
  });
}

export async function cancelAdmission(params: { hospitalId: string; admissionId: string }) {
  return prisma.$transaction(async (tx) => {
    const admission = await tx.admission.findFirst({
      where: { id: params.admissionId, hospitalId: params.hospitalId, status: { in: [...ACTIVE_ADMISSION_STATUSES] } },
    });
    if (!admission) throw new WardError("Active admission not found.", 404);
    const invoices = await tx.invoice.count({ where: { admissionId: admission.id, status: { not: "VOID" } } });
    if (invoices > 0) throw new WardError("Cancel is not allowed after an IPD bill has been issued.");
    await lockBed(tx, admission.bedId);
    await tx.admission.update({
      where: { id: admission.id },
      data: { status: "CANCELLED", dischargedAt: new Date() },
    });
    await tx.bed.update({ where: { id: admission.bedId }, data: vacateBedData("AVAILABLE") });
    return admission.id;
  });
}

export async function generateIpdInvoice(params: {
  hospitalId: string;
  hospitalCode: string;
  admissionId: string;
  applyAdvance?: boolean;
  extraItems?: { description: string; amount: number }[];
}) {
  const admission = await prisma.admission.findFirst({
    where: { id: params.admissionId, hospitalId: params.hospitalId },
    include: { patient: true, bed: { include: { ward: true } }, invoices: true },
  });
  if (!admission) throw new WardError("Admission not found.", 404);
  if (admission.status === "CANCELLED") throw new WardError("Cancelled stays cannot be billed.");

  const existing = admission.invoices.find((row) => row.status !== "VOID");
  if (existing) return existing;

  const days = stayDays(admission.admittedAt, admission.dischargedAt ?? new Date());
  const dailyRate = Number(admission.bed.ward.dailyRate);
  const nursingRate = Number(admission.bed.ward.nursingRate);
  const items = [
    {
      description: `Bed charges — ${admission.bed.ward.name} ${admission.bed.number} × ${days} day(s)`,
      amount: dailyRate * days,
    },
    ...(nursingRate > 0
      ? [
          {
            description: `Nursing charges × ${days} day(s)`,
            amount: nursingRate * days,
          },
        ]
      : []),
    ...(params.extraItems ?? []).filter((item) => item.description && item.amount > 0),
  ].filter((item) => item.amount > 0);

  if (items.length === 0) {
    items.push({
      description: `IPD stay ${admission.ipNumber} — ${admission.bed.ward.name} ${admission.bed.number}`,
      amount: 0,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  let paidAmount = 0;
  let applyAdvance = 0;
  if (params.applyAdvance) {
    applyAdvance = Math.min(Number(admission.patient.advanceBalance), subtotal);
    paidAmount = applyAdvance;
  }

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        hospitalId: params.hospitalId,
        invoiceNo: await nextInvoiceNo(params.hospitalId, params.hospitalCode),
        patientId: admission.patientId,
        admissionId: admission.id,
        status: invoiceStatusFromTotals(subtotal, paidAmount),
        subtotal,
        netTotal: subtotal,
        paidAmount,
        items: { create: items },
      },
    });
    if (applyAdvance > 0) {
      await tx.payment.create({
        data: {
          hospitalId: params.hospitalId,
          patientId: admission.patientId,
          invoiceId: invoice.id,
          admissionId: admission.id,
          kind: "COLLECTION",
          method: "ADVANCE",
          amount: applyAdvance,
          notes: `Applied from patient advance to ${admission.ipNumber}`,
        },
      });
      await tx.patient.update({
        where: { id: admission.patientId },
        data: { advanceBalance: { decrement: applyAdvance } },
      });
    }
    return invoice;
  });
}

export async function dischargeAdmission(params: {
  hospitalId: string;
  hospitalCode: string;
  admissionId: string;
  dischargeType: DischargeType;
  notes?: string | null;
  applyAdvance?: boolean;
}) {
  const admissionId = await prisma.$transaction(async (tx) => {
    const admission = await tx.admission.findFirst({
      where: { id: params.admissionId, hospitalId: params.hospitalId, status: { in: [...ACTIVE_ADMISSION_STATUSES] } },
    });
    if (!admission) throw new WardError("Active admission not found.", 404);
    await lockBed(tx, admission.bedId);
    await tx.admission.update({
      where: { id: admission.id },
      data: {
        status: "DISCHARGED",
        dischargedAt: new Date(),
        dischargeType: params.dischargeType,
        dischargeNotes: params.notes?.trim() || admission.dischargeNotes,
      },
    });
    await tx.bed.update({ where: { id: admission.bedId }, data: vacateBedData("HOUSEKEEPING") });
    return admission.id;
  });

  const invoice = await generateIpdInvoice({
    hospitalId: params.hospitalId,
    hospitalCode: params.hospitalCode,
    admissionId,
    applyAdvance: params.applyAdvance ?? true,
  });
  return { admissionId, invoiceId: invoice.id };
}

export const admissionInclude = {
  patient: true,
  department: true,
  bed: { include: { ward: { include: { department: true } } } },
  admittingDoctor: { include: { appUser: { select: { username: true } } } },
  attendingDoctor: { include: { appUser: { select: { username: true } } } },
  invoices: { orderBy: { issuedAt: "desc" as const }, take: 5 },
  transfers: {
    orderBy: { transferredAt: "desc" as const },
    include: {
      fromBed: { include: { ward: true } },
      toBed: { include: { ward: true } },
    },
  },
} satisfies Prisma.AdmissionInclude;
