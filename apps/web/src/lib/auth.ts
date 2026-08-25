import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { AppRole } from "@prisma/client";
import { prisma } from "./prisma";
import { SESSION_COOKIE, getUserBySessionToken } from "./session-user";

export { SESSION_COOKIE, getUserBySessionToken };
export { normalizeMobile, isValidIndianMobile, mobileValidationError } from "./phone";

const SESSION_DAYS = 7;
export const DEFAULT_OTP = "1234";

export const STAFF_ROLES: AppRole[] = [
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "PHARMACIST",
  "LAB_TECH",
  "ACCOUNTANT",
];

export const PLATFORM_ROLES: AppRole[] = ["SOFTWARE_ADMIN", "HELPDESK"];

export function isPlatformRole(role: AppRole) {
  return role === "SOFTWARE_ADMIN" || role === "HELPDESK";
}

export function homeForRole(role: AppRole, hospitalId?: string | null) {
  if (role === "HELPDESK") return "/helpdesk";
  if (!isPlatformRole(role) && !hospitalId) return "/join";
  return "/";
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function normalizeHospitalCode(code: string) {
  return code.trim().toUpperCase();
}

export function readBearerToken(request?: Request | null) {
  const header = request?.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.appSession.create({
    data: { token, userId, expiresAt },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.appSession.deleteMany({ where: { token } });
  }

  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(request?: Request) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value ?? readBearerToken(request);
  return getUserBySessionToken(token);
}
