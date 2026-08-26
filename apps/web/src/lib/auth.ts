import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { AppRole } from "@prisma/client";
import { prisma } from "./prisma";
import { SESSION_COOKIE, getUserBySessionToken } from "./session-user";

export { SESSION_COOKIE, getUserBySessionToken };
export { normalizeMobile, isValidIndianMobile, mobileValidationError } from "./phone";

const SESSION_DAYS = 7;
const BCRYPT_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 8;

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

export function passwordValidationError(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/** Valid bcrypt hash used only so failed logins take similar time when the user is missing. */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("__mederp_timing__", BCRYPT_ROUNDS);

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function normalizeHospitalCode(code: string) {
  return code.trim().toUpperCase();
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readBearerToken(request?: Request | null) {
  const header = request?.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.appSession.create({
    data: { token: tokenHash, userId, expiresAt },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, rawToken, sessionCookieOptions(expiresAt));
  return rawToken;
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.appSession.deleteMany({ where: { token: hashSessionToken(token) } });
  }

  jar.delete(SESSION_COOKIE);
}

export async function invalidateUserSessions(userId: string) {
  await prisma.appSession.deleteMany({ where: { userId } });
}

export async function getCurrentUser(request?: Request) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value ?? readBearerToken(request);
  return getUserBySessionToken(token);
}
