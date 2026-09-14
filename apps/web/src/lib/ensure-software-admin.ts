import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const SOFTWARE_ADMIN_USERNAME = "softwareadmin";
const SOFTWARE_ADMIN_MOBILE = "9999999999";
const SOFTWARE_ADMIN_PASSWORD = "Software@123";

/**
 * Ensures the platform software-admin login exists after DB wipe / fresh migrate.
 * Idempotent: restores the known mobile + password used in docs and local seed.
 */
export async function ensureSoftwareAdmin() {
  const passwordHash = await bcrypt.hash(SOFTWARE_ADMIN_PASSWORD, 12);
  await prisma.appUser.upsert({
    where: { username: SOFTWARE_ADMIN_USERNAME },
    update: {
      mobile: SOFTWARE_ADMIN_MOBILE,
      passwordHash,
      role: "SOFTWARE_ADMIN",
      isVerified: true,
      isActive: true,
      hospitalId: null,
    },
    create: {
      username: SOFTWARE_ADMIN_USERNAME,
      mobile: SOFTWARE_ADMIN_MOBILE,
      passwordHash,
      otpCode: null,
      isVerified: true,
      isActive: true,
      role: "SOFTWARE_ADMIN",
    },
  });
}
