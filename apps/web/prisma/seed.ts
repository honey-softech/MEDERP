import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { LAB_CATALOG } from "../src/lib/lab-catalog";

const prisma = new PrismaClient();

const SOFTWARE_ADMIN_MOBILE = "9999999999";
const SOFTWARE_ADMIN_PASSWORD = "Software@123";

async function ensureSoftwareAdmin() {
  const passwordHash = await bcrypt.hash(SOFTWARE_ADMIN_PASSWORD, 12);
  await prisma.appUser.upsert({
    where: { username: "softwareadmin" },
    update: {
      mobile: SOFTWARE_ADMIN_MOBILE,
      passwordHash,
      role: "SOFTWARE_ADMIN",
      isVerified: true,
      isActive: true,
      hospitalId: null,
    },
    create: {
      username: "softwareadmin",
      mobile: SOFTWARE_ADMIN_MOBILE,
      passwordHash,
      otpCode: null,
      isVerified: true,
      isActive: true,
      role: "SOFTWARE_ADMIN",
    },
  });
}

async function main() {
  await ensureSoftwareAdmin();

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

  console.log(`Seeded software admin (${SOFTWARE_ADMIN_MOBILE} / ${SOFTWARE_ADMIN_PASSWORD}). Create hospitals from the SaaS console.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
