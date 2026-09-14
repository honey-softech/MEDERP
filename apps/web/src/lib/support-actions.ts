import type { AppRole, AppUser, HelpdeskTicket } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import {
  hashPassword,
  invalidateUserSessions,
  passwordValidationError,
} from "@/lib/auth";
import { isValidIndianMobile, normalizeMobile } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  isSupportTierAction,
  SUPPORT_ACTIONS,
  supportActionLabel,
} from "@/lib/support-action-options";

export {
  isSupportTierAction,
  SUPPORT_ACTIONS,
  supportActionLabel,
  type SupportActionId,
  type SupportActionTier,
  type SupportTierActionId,
} from "@/lib/support-action-options";

/** Support-tier fixes: software admin now, helpdesk agents after the team split. */
export function canRunSupportAction(role: AppRole) {
  return role === "SOFTWARE_ADMIN" || role === "HELPDESK";
}

type Actor = Pick<AppUser, "id" | "username" | "role">;
type TicketRef = Pick<HelpdeskTicket, "id" | "number" | "hospitalId" | "createdById">;

export type SupportActionResult =
  | { ok: true; summary: string; threadNote: string }
  | { ok: false; error: string; status: number };

async function loadTargetUser(userId: string) {
  return prisma.appUser.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      mobile: true,
      role: true,
      hospitalId: true,
      isActive: true,
      isVerified: true,
      otpAttempts: true,
    },
  });
}

function refusePlatformAccount(role: AppRole) {
  return role === "SOFTWARE_ADMIN" || role === "HELPDESK";
}

async function appendThreadNote(ticketId: string, authorId: string, body: string) {
  await prisma.helpdeskMessage.create({
    data: { ticketId, authorId, body, kind: "SYSTEM" },
  });
}

async function auditSupportAction(params: {
  request: Request;
  actor: Actor;
  ticket: TicketRef;
  action: string;
  targetUserId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await writeAuditLog({
    request: params.request,
    hospitalId: params.ticket.hospitalId,
    actorUserId: params.actor.id,
    actorUsername: params.actor.username,
    actorRole: params.actor.role,
    action: "SUPPORT_ACTION",
    entity: "HelpdeskTicket",
    entityId: params.ticket.id,
    summary: params.summary,
    metadata: {
      ticketNumber: params.ticket.number,
      supportAction: params.action,
      targetUserId: params.targetUserId,
      ...params.metadata,
    },
  });
}

export async function runSupportAction(params: {
  request: Request;
  actor: Actor;
  ticket: TicketRef;
  action: string;
  targetUserId?: string;
  password?: string;
  mobile?: string;
}): Promise<SupportActionResult> {
  if (!canRunSupportAction(params.actor.role)) {
    return { ok: false, error: "Helpdesk or software admin access required.", status: 403 };
  }
  if (!isSupportTierAction(params.action)) {
    return { ok: false, error: "Unknown or unsupported support action.", status: 400 };
  }

  const targetUserId = params.targetUserId || params.ticket.createdById;
  if (!targetUserId) {
    return { ok: false, error: "This ticket has no linked user account to act on.", status: 400 };
  }

  const target = await loadTargetUser(targetUserId);
  if (!target) {
    return { ok: false, error: "Target user not found.", status: 404 };
  }
  if (refusePlatformAccount(target.role)) {
    return { ok: false, error: "Platform accounts cannot be changed from support actions.", status: 403 };
  }
  if (params.ticket.hospitalId && target.hospitalId && params.ticket.hospitalId !== target.hospitalId) {
    return { ok: false, error: "User does not belong to this ticket's hospital.", status: 400 };
  }

  const label = supportActionLabel(params.action);

  switch (params.action) {
    case "RESET_PASSWORD": {
      const password = String(params.password ?? "");
      const passwordError = passwordValidationError(password);
      if (passwordError) return { ok: false, error: passwordError, status: 400 };
      await prisma.appUser.update({
        where: { id: target.id },
        data: { passwordHash: await hashPassword(password) },
      });
      await invalidateUserSessions(target.id);
      const summary = `${params.actor.username} reset password for ${target.username} via ${params.ticket.number}.`;
      const threadNote = `Support action: ${label} for ${target.username} (${target.mobile}). Sessions signed out.`;
      await appendThreadNote(params.ticket.id, params.actor.id, threadNote);
      await auditSupportAction({
        request: params.request,
        actor: params.actor,
        ticket: params.ticket,
        action: params.action,
        targetUserId: target.id,
        summary,
        metadata: { username: target.username },
      });
      return { ok: true, summary, threadNote };
    }
    case "FIX_MOBILE": {
      const mobile = normalizeMobile(String(params.mobile ?? ""));
      if (!isValidIndianMobile(mobile)) {
        return { ok: false, error: "Enter a valid 10-digit mobile number.", status: 400 };
      }
      const clash = await prisma.appUser.findFirst({
        where: { mobile, id: { not: target.id } },
        select: { id: true },
      });
      if (clash) {
        return { ok: false, error: "That mobile number is already registered.", status: 409 };
      }
      const previous = target.mobile;
      await prisma.appUser.update({ where: { id: target.id }, data: { mobile } });
      await invalidateUserSessions(target.id);
      const summary = `${params.actor.username} corrected mobile for ${target.username} via ${params.ticket.number}.`;
      const threadNote = `Support action: ${label} for ${target.username}: ${previous} → ${mobile}. Sessions signed out.`;
      await appendThreadNote(params.ticket.id, params.actor.id, threadNote);
      await auditSupportAction({
        request: params.request,
        actor: params.actor,
        ticket: params.ticket,
        action: params.action,
        targetUserId: target.id,
        summary,
        metadata: { previousMobile: previous, mobile },
      });
      return { ok: true, summary, threadNote };
    }
    case "MARK_VERIFIED": {
      await prisma.appUser.update({
        where: { id: target.id },
        data: { isVerified: true, otpCode: null, otpExpiresAt: null, otpAttempts: 0 },
      });
      const summary = `${params.actor.username} marked ${target.username} verified via ${params.ticket.number}.`;
      const threadNote = `Support action: ${label} for ${target.username} (${target.mobile}).`;
      await appendThreadNote(params.ticket.id, params.actor.id, threadNote);
      await auditSupportAction({
        request: params.request,
        actor: params.actor,
        ticket: params.ticket,
        action: params.action,
        targetUserId: target.id,
        summary,
      });
      return { ok: true, summary, threadNote };
    }
    case "REACTIVATE_USER": {
      await prisma.appUser.update({
        where: { id: target.id },
        data: { isActive: true },
      });
      const summary = `${params.actor.username} reactivated ${target.username} via ${params.ticket.number}.`;
      const threadNote = `Support action: ${label} for ${target.username} (${target.mobile}).`;
      await appendThreadNote(params.ticket.id, params.actor.id, threadNote);
      await auditSupportAction({
        request: params.request,
        actor: params.actor,
        ticket: params.ticket,
        action: params.action,
        targetUserId: target.id,
        summary,
      });
      return { ok: true, summary, threadNote };
    }
    case "CLEAR_OTP_LOCK": {
      await prisma.appUser.update({
        where: { id: target.id },
        data: { otpCode: null, otpExpiresAt: null, otpAttempts: 0 },
      });
      const summary = `${params.actor.username} cleared OTP lockout for ${target.username} via ${params.ticket.number}.`;
      const threadNote = `Support action: ${label} for ${target.username} (${target.mobile}).`;
      await appendThreadNote(params.ticket.id, params.actor.id, threadNote);
      await auditSupportAction({
        request: params.request,
        actor: params.actor,
        ticket: params.ticket,
        action: params.action,
        targetUserId: target.id,
        summary,
        metadata: { previousOtpAttempts: target.otpAttempts },
      });
      return { ok: true, summary, threadNote };
    }
    case "SIGN_OUT_ALL": {
      await invalidateUserSessions(target.id);
      const summary = `${params.actor.username} signed out all sessions for ${target.username} via ${params.ticket.number}.`;
      const threadNote = `Support action: ${label} for ${target.username} (${target.mobile}).`;
      await appendThreadNote(params.ticket.id, params.actor.id, threadNote);
      await auditSupportAction({
        request: params.request,
        actor: params.actor,
        ticket: params.ticket,
        action: params.action,
        targetUserId: target.id,
        summary,
      });
      return { ok: true, summary, threadNote };
    }
    default:
      return { ok: false, error: "Unknown support action.", status: 400 };
  }
}
