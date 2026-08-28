import type { AppRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { invoiceStatusFromTotals, nextInvoiceNo, patientName } from "@/lib/front-desk";
import { ALL_LAB_CATALOG, investigationLineName, type InvestigationPick } from "@/lib/lab-catalog";
import { notifyHospitalRole, notifyUser } from "@/lib/notifications";
import { activeSignatureFor } from "@/lib/signatures";

export const LAB_WORK_ROLES: AppRole[] = ["SUPER_ADMIN", "LAB_TECH"];
export const LAB_VIEW_ROLES: AppRole[] = ["SUPER_ADMIN", "LAB_TECH", "DOCTOR", "NURSE", "RECEPTIONIST"];

export async function syncLabCatalog() {
  let sort = 0;
  for (const test of ALL_LAB_CATALOG) {
    sort += 10;
    const kind = test.kind === "SCAN" ? "SCAN" : "BLOOD";
    await prisma.labTest.upsert({
      where: { code: test.code },
      update: {
        name: test.name,
        category: test.category,
        description: test.description ?? null,
        price: test.price,
        sortOrder: sort,
        kind,
        isActive: true,
      },
      create: {
        code: test.code,
        name: test.name,
        category: test.category,
        description: test.description ?? null,
        price: test.price,
        sortOrder: sort,
        kind,
        isActive: true,
      },
    });
  }
  const keepCodes = ALL_LAB_CATALOG.map((test) => test.code);
  await prisma.labTest.updateMany({
    where: { kind: "SCAN", code: { notIn: keepCodes } },
    data: { isActive: false },
  });
}

export function investigationsEditable(order: { status: string; fulfillment?: string | null }) {
  if (order.fulfillment === "EXTERNAL") return order.status === "AWAITING_EXTERNAL_REPORT";
  return order.status === "AWAITING_PAYMENT";
}

/** Open draft for this visit. Paid / completed waves stay as history so more can be ordered. */
export async function findEditableVisitLabOrder(appointmentId: string) {
  return prisma.labOrder.findFirst({
    where: {
      appointmentId,
      status: { in: ["AWAITING_PAYMENT", "AWAITING_EXTERNAL_REPORT"] },
    },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
}

export async function offeredTestsForHospital(hospitalId: string) {
  await syncLabCatalog();
  const tests = await prisma.labTest.findMany({
    where: { isActive: true },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { hospitalPrices: { where: { hospitalId } } },
  });
  return tests
    .map((test) => {
      const override = test.hospitalPrices[0];
      return {
        id: test.id,
        code: test.code,
        name: test.name,
        category: test.category,
        kind: test.kind,
        description: test.description,
        price: Number(override?.price ?? test.price),
        isOffered: override?.isOffered ?? true,
      };
    })
    .filter((test) => test.isOffered);
}

export async function upsertVisitLabOrder(params: {
  hospitalId: string;
  appointmentId: string;
  patientId: string;
  orderedByUserId: string;
  orderedByUsername: string;
  investigations: InvestigationPick[];
}) {
  const hospital = await prisma.hospital.findUnique({
    where: { id: params.hospitalId },
    select: { labEnabled: true },
  });
  const inHouseLab = Boolean(hospital?.labEnabled);
  const fulfillment = inHouseLab ? ("HOSPITAL_LAB" as const) : ("EXTERNAL" as const);
  const initialStatus = inHouseLab ? ("AWAITING_PAYMENT" as const) : ("AWAITING_EXTERNAL_REPORT" as const);

  const existing = await findEditableVisitLabOrder(params.appointmentId);
  const signature = await activeSignatureFor(params.orderedByUserId, params.hospitalId);

  const offered = await offeredTestsForHospital(params.hospitalId);
  const byId = new Map(offered.map((test) => [test.id, test]));
  const selected = params.investigations
    .map((pick) => {
      const test = byId.get(pick.testId);
      if (!test) return null;
      const siteLabel = String(pick.siteLabel ?? "").trim() || null;
      const needsSite = test.kind === "SCAN" && test.code !== "ECG" && test.code !== "ECHO";
      if (needsSite && !siteLabel) return null;
      return {
        test,
        siteLabel,
        nameSnapshot: investigationLineName(test.name, siteLabel),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const total = selected.reduce((sum, row) => sum + row.test.price, 0);
  const label = selected.length === 1 ? "investigation" : "investigations";

  if (selected.length === 0) {
    if (existing) {
      if (existing.invoiceId) {
        const invoice = await prisma.invoice.findUnique({ where: { id: existing.invoiceId } });
        if (invoice && Number(invoice.paidAmount) === 0) {
          await prisma.invoice.delete({ where: { id: invoice.id } });
        }
      }
      await prisma.labOrder.update({
        where: { id: existing.id },
        data: { status: "CANCELLED", totalAmount: 0, invoiceId: null, items: { deleteMany: {} } },
      });
    }
    return null;
  }

  const items = {
    create: selected.map((row) => ({
      testId: row.test.id,
      nameSnapshot: row.nameSnapshot,
      categorySnapshot: row.test.category,
      siteLabel: row.siteLabel,
      unitPrice: row.test.price,
    })),
  };

  if (existing) {
    const updated = await prisma.labOrder.update({
      where: { id: existing.id },
      data: {
        fulfillment,
        status: initialStatus,
        totalAmount: total,
        orderedByUserId: params.orderedByUserId,
        orderedByUsername: params.orderedByUsername,
        orderedBySignatureId: signature?.id ?? null,
        items: { deleteMany: {}, ...items },
      },
    });
    if (inHouseLab) await syncLabInvoiceItems(updated.id);
    return updated;
  }

  const order = await prisma.labOrder.create({
    data: {
      hospitalId: params.hospitalId,
      appointmentId: params.appointmentId,
      patientId: params.patientId,
      orderedByUserId: params.orderedByUserId,
      orderedByUsername: params.orderedByUsername,
      orderedBySignatureId: signature?.id ?? null,
      fulfillment,
      status: initialStatus,
      totalAmount: total,
      items,
    },
  });

  if (inHouseLab) {
    const body = `${params.orderedByUsername} ordered ${selected.length} ${label}. Collect payment, then laboratory is notified.`;
    await notifyHospitalRole({
      hospitalId: params.hospitalId,
      role: "RECEPTIONIST",
      appointmentId: params.appointmentId,
      href: `/billing/lab/${order.id}`,
      title: "Lab tests to collect",
      body,
    });
    await notifyHospitalRole({
      hospitalId: params.hospitalId,
      role: "SUPER_ADMIN",
      appointmentId: params.appointmentId,
      href: `/billing/lab/${order.id}`,
      title: "Lab tests to collect",
      body,
    });
  } else {
    const body = `${params.orderedByUsername} recommended ${selected.length} ${label} to be done outside. Share the list with the patient (WhatsApp/SMS later). Attach the report when they bring it.`;
    await notifyHospitalRole({
      hospitalId: params.hospitalId,
      role: "RECEPTIONIST",
      appointmentId: params.appointmentId,
      href: `/appointments/${params.appointmentId}`,
      title: "Outside tests / scans recommended",
      body,
    });
    await notifyHospitalRole({
      hospitalId: params.hospitalId,
      role: "SUPER_ADMIN",
      appointmentId: params.appointmentId,
      href: `/appointments/${params.appointmentId}`,
      title: "Outside tests / scans recommended",
      body,
    });
  }
  return order;
}

export async function notifyLabPaid(params: {
  hospitalId: string;
  appointmentId?: string | null;
  orderId: string;
  patientName: string;
  testCount: number;
}) {
  const href = `/lab/${params.orderId}`;
  const title = "Lab payment received — collect sample";
  const body = `Payment is done for ${params.patientName} (${params.testCount} blood test${params.testCount === 1 ? "" : "s"}). Collect the sample and update results.`;
  await Promise.all([
    notifyHospitalRole({
      hospitalId: params.hospitalId,
      role: "LAB_TECH",
      appointmentId: params.appointmentId,
      href,
      title,
      body,
    }),
    notifyHospitalRole({
      hospitalId: params.hospitalId,
      role: "SUPER_ADMIN",
      appointmentId: params.appointmentId,
      href,
      title,
      body,
    }),
  ]);
}

export async function notifyLabResults(params: {
  hospitalId: string;
  appointmentId?: string | null;
  orderId: string;
  patientId: string;
  patientName: string;
  doctorUserId?: string | null;
  external?: boolean;
}) {
  const href = params.appointmentId ? `/appointments/${params.appointmentId}` : `/patients/${params.patientId}`;
  const title = params.external ? "Outside report attached" : "Lab report ready";
  const body = params.external
    ? `The outside report for ${params.patientName} is on the visit. Review it, update the assessment, and approve the visit summary.`
    : `Lab report is on the patient record for ${params.patientName}.`;
  await notifyHospitalRole({
    hospitalId: params.hospitalId,
    role: "NURSE",
    appointmentId: params.appointmentId,
    href,
    title,
    body,
  });
  if (params.doctorUserId) {
    await notifyUser({
      hospitalId: params.hospitalId,
      userId: params.doctorUserId,
      appointmentId: params.appointmentId,
      href,
      title,
      body,
    });
  } else {
    await notifyHospitalRole({
      hospitalId: params.hospitalId,
      role: "DOCTOR",
      appointmentId: params.appointmentId,
      href,
      title,
      body,
    });
  }
}

function invoiceNet(subtotal: number, discountAmount: number, waiverStatus: string, waiverAmount: number) {
  const waiver = waiverStatus === "APPROVED" ? waiverAmount : 0;
  return Math.max(0, subtotal - discountAmount - waiver);
}

export async function syncLabInvoiceItems(orderId: string) {
  const order = await prisma.labOrder.findUnique({
    where: { id: orderId },
    include: { items: true, invoice: true },
  });
  if (!order?.invoice || Number(order.invoice.paidAmount) > 0) return order?.invoice ?? null;

  const subtotal = Number(order.totalAmount);
  const netTotal = invoiceNet(
    subtotal,
    Number(order.invoice.discountAmount),
    order.invoice.waiverStatus,
    Number(order.invoice.waiverAmount),
  );

  await prisma.$transaction([
    prisma.invoiceItem.deleteMany({ where: { invoiceId: order.invoice.id } }),
    prisma.invoice.update({
      where: { id: order.invoice.id },
      data: {
        subtotal,
        netTotal,
        status: invoiceStatusFromTotals(netTotal, Number(order.invoice.paidAmount)),
        items: {
          create: order.items.map((item) => ({
            description: `Lab · ${item.nameSnapshot}`,
            amount: item.unitPrice,
          })),
        },
      },
    }),
  ]);
  return prisma.invoice.findUnique({ where: { id: order.invoice.id } });
}

export async function ensureLabInvoice(params: { orderId: string; hospitalId: string; hospitalCode: string }) {
  const order = await prisma.labOrder.findFirst({
    where: { id: params.orderId, hospitalId: params.hospitalId },
    include: { items: true, invoice: true },
  });
  if (!order || order.items.length === 0 || order.fulfillment === "EXTERNAL") return null;
  if (order.invoice) {
    await syncLabInvoiceItems(order.id);
    return prisma.invoice.findUnique({ where: { id: order.invoice.id } });
  }

  const subtotal = Number(order.totalAmount);
  const invoice = await prisma.invoice.create({
    data: {
      hospitalId: params.hospitalId,
      invoiceNo: await nextInvoiceNo(params.hospitalId, params.hospitalCode),
      patientId: order.patientId,
      subtotal,
      netTotal: subtotal,
      paidAmount: 0,
      status: "ISSUED",
      items: {
        create: order.items.map((item) => ({
          description: `Lab · ${item.nameSnapshot}`,
          amount: item.unitPrice,
        })),
      },
    },
  });
  await prisma.labOrder.update({ where: { id: order.id }, data: { invoiceId: invoice.id } });
  return invoice;
}

export async function syncLabOrderPaymentFromInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      labOrders: { include: { items: true, patient: true } },
    },
  });
  if (!invoice || invoice.labOrders.length === 0) return;

  const due = Number(invoice.netTotal) - Number(invoice.paidAmount);
  const paidOff = due <= 0.01;

  for (const order of invoice.labOrders) {
    if (order.fulfillment === "EXTERNAL") continue;
    if (paidOff && order.status === "AWAITING_PAYMENT") {
      await prisma.labOrder.update({
        where: { id: order.id },
        data: { status: "PAID", paidAt: new Date(), invoiceId: invoice.id },
      });
      await notifyLabPaid({
        hospitalId: invoice.hospitalId,
        appointmentId: order.appointmentId,
        orderId: order.id,
        patientName: patientName(order.patient),
        testCount: order.items.length,
      });
    }
    if (!paidOff && order.status === "PAID") {
      await prisma.labOrder.update({
        where: { id: order.id },
        data: { status: "AWAITING_PAYMENT", paidAt: null },
      });
    }
  }
}
