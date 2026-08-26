import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { LAB_CATALOG } from "../src/lib/lab-catalog";

const prisma = new PrismaClient();

async function main() {
  await prisma.appUser.upsert({
    where: { username: "softwareadmin" },
    update: {
      role: "SOFTWARE_ADMIN",
      isVerified: true,
      isActive: true,
      hospitalId: null,
    },
    create: {
      username: "softwareadmin",
      mobile: "9999999999",
      passwordHash: await bcrypt.hash("Software@123", 12),
      otpCode: null,
      isVerified: true,
      role: "SOFTWARE_ADMIN",
    },
  });

  let sort = 0;
  for (const test of LAB_CATALOG) {
    sort += 10;
    await prisma.labTest.upsert({
      where: { code: test.code },
      update: {
        name: test.name,
        category: test.category,
        description: test.description ?? null,
        price: test.price,
        sortOrder: sort,
        kind: "BLOOD",
        isActive: true,
      },
      create: {
        code: test.code,
        name: test.name,
        category: test.category,
        description: test.description ?? null,
        price: test.price,
        sortOrder: sort,
        kind: "BLOOD",
        isActive: true,
      },
    });
  }

  await prisma.platformBillingSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  await prisma.platformCounter.upsert({
    where: { kind: "platform_invoice" },
    update: {},
    create: { kind: "platform_invoice", value: 0 },
  });

  console.log("Seeded software admin only. Create hospitals from the SaaS console.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
