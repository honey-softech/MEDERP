import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const cardiology = await prisma.department.upsert({
    where: { code: "CARD" },
    update: {},
    create: {
      name: "Cardiology",
      code: "CARD",
      description: "Heart and vascular care",
    },
  });

  const general = await prisma.department.upsert({
    where: { code: "GEN" },
    update: {},
    create: {
      name: "General Medicine",
      code: "GEN",
      description: "Outpatient and inpatient general care",
    },
  });

  const doctor = await prisma.staff.upsert({
    where: { email: "dr.mehta@mederp.local" },
    update: {},
    create: {
      email: "dr.mehta@mederp.local",
      passwordHash: "change-me",
      firstName: "Ananya",
      lastName: "Mehta",
      role: "DOCTOR",
      phone: "+91 90000 11111",
      departmentId: cardiology.id,
    },
  });

  await prisma.staff.upsert({
    where: { email: "admin@mederp.local" },
    update: {},
    create: {
      email: "admin@mederp.local",
      passwordHash: "change-me",
      firstName: "Hospital",
      lastName: "Admin",
      role: "ADMIN",
      phone: "+91 90000 00000",
    },
  });

  const patient = await prisma.patient.upsert({
    where: { mrn: "MRN-1001" },
    update: {},
    create: {
      mrn: "MRN-1001",
      firstName: "Rahul",
      lastName: "Sharma",
      dateOfBirth: new Date("1988-04-12"),
      gender: "MALE",
      phone: "+91 98765 43210",
      bloodGroup: "B+",
      emergencyName: "Priya Sharma",
      emergencyPhone: "+91 98765 00000",
    },
  });

  await prisma.patient.upsert({
    where: { mrn: "MRN-1002" },
    update: {},
    create: {
      mrn: "MRN-1002",
      firstName: "Fatima",
      lastName: "Khan",
      dateOfBirth: new Date("1994-11-03"),
      gender: "FEMALE",
      phone: "+91 98111 22334",
      bloodGroup: "O+",
    },
  });

  const existingAppt = await prisma.appointment.findFirst({
    where: { patientId: patient.id, doctorId: doctor.id },
  });
  if (!existingAppt) {
    await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        departmentId: cardiology.id,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reason: "Follow-up for hypertension",
      },
    });
  }

  await prisma.medicine.upsert({
    where: { sku: "PARA-500" },
    update: {},
    create: {
      name: "Paracetamol 500mg",
      sku: "PARA-500",
      unit: "tablet",
      stockQty: 1200,
      reorderLevel: 200,
      unitPrice: 2.5,
    },
  });

  await prisma.labTest.upsert({
    where: { code: "CBC" },
    update: {},
    create: { name: "Complete Blood Count", code: "CBC", price: 450 },
  });

  const ward = await prisma.ward.findFirst({ where: { name: "Cardio Ward A" } });
  if (!ward) {
    await prisma.ward.create({
      data: {
        name: "Cardio Ward A",
        departmentId: cardiology.id,
        beds: {
          create: [{ number: "A-101" }, { number: "A-102" }, { number: "A-103" }],
        },
      },
    });
  }

  console.log("Seeded MedERP sample data.");
  console.log(`Departments: ${cardiology.code}, ${general.code}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
