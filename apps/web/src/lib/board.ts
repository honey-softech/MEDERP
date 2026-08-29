import type { AppRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyHospitalStaffExcept, notifyUser } from "@/lib/notifications";

export { boardAuthorName, prettyRole } from "@/lib/board-display";

const TITLE_MIN = 2;
const TITLE_MAX = 120;
const BODY_MIN = 2;
const BODY_MAX = 4000;
const REPLY_MIN = 2;
const REPLY_MAX = 2000;

const authorSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  role: true,
} satisfies Prisma.AppUserSelect;

export type BoardAuthor = {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  role: AppRole;
};

export type BoardReply = {
  id: string;
  body: string;
  createdAt: Date;
  author: BoardAuthor;
};

export type BoardPost = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  author: BoardAuthor;
  replies: BoardReply[];
  replyCount: number;
};

export function parseAnnouncementTitle(value: unknown) {
  const title = String(value ?? "").trim();
  if (title.length < TITLE_MIN) return { error: "Enter a short title." };
  if (title.length > TITLE_MAX) return { error: `Title must be ${TITLE_MAX} characters or fewer.` };
  return { title };
}

export function parseAnnouncementBody(value: unknown) {
  const body = String(value ?? "").trim();
  if (body.length < BODY_MIN) return { error: "Write a bit more detail so the hospital can act on it." };
  if (body.length > BODY_MAX) return { error: `Message must be ${BODY_MAX} characters or fewer.` };
  return { body };
}

export function parseReplyBody(value: unknown) {
  const body = String(value ?? "").trim();
  if (body.length < REPLY_MIN) return { error: "Enter a reply." };
  if (body.length > REPLY_MAX) return { error: `Reply must be ${REPLY_MAX} characters or fewer.` };
  return { body };
}

function toPost(row: {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  author: BoardAuthor;
  replies?: BoardReply[];
  _count?: { replies: number };
}): BoardPost {
  const replies = row.replies ?? [];
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    createdAt: row.createdAt,
    author: row.author,
    replies,
    replyCount: row._count?.replies ?? replies.length,
  };
}

export async function listAnnouncements(
  hospitalId: string,
  options?: { take?: number; includeReplies?: boolean },
) {
  const take = options?.take ?? 50;
  const includeReplies = options?.includeReplies ?? false;
  if (includeReplies) {
    const rows = await prisma.hospitalAnnouncement.findMany({
      where: { hospitalId },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take,
      include: {
        author: { select: authorSelect },
        _count: { select: { replies: true } },
        replies: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: authorSelect } },
        },
      },
    });
    return rows.map(toPost);
  }

  const rows = await prisma.hospitalAnnouncement.findMany({
    where: { hospitalId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      author: { select: authorSelect },
      _count: { select: { replies: true } },
    },
  });
  return rows.map(toPost);
}

export async function getAnnouncementInHospital(id: string, hospitalId: string) {
  return prisma.hospitalAnnouncement.findFirst({
    where: { id, hospitalId },
    include: {
      author: { select: authorSelect },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: authorSelect } },
      },
      _count: { select: { replies: true } },
    },
  });
}

export function canManageAnnouncement(actor: { id: string; role: AppRole }, authorId: string) {
  return actor.role === "SUPER_ADMIN" || actor.id === authorId;
}

export async function createAnnouncement(params: {
  hospitalId: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
}) {
  const post = await prisma.hospitalAnnouncement.create({
    data: {
      hospitalId: params.hospitalId,
      authorId: params.authorId,
      title: params.title,
      body: params.body,
    },
    include: {
      author: { select: authorSelect },
      _count: { select: { replies: true } },
    },
  });

  await notifyHospitalStaffExcept({
    hospitalId: params.hospitalId,
    exceptUserId: params.authorId,
    title: "New hospital message",
    body: `${params.authorName}: ${params.title}`,
    href: "/",
  });

  return toPost(post);
}

export async function setAnnouncementPinned(params: {
  id: string;
  hospitalId: string;
  pinned: boolean;
}) {
  const existing = await prisma.hospitalAnnouncement.findFirst({
    where: { id: params.id, hospitalId: params.hospitalId },
  });
  if (!existing) return { error: "Announcement not found.", status: 404 as const };

  const post = await prisma.hospitalAnnouncement.update({
    where: { id: existing.id },
    data: { pinned: params.pinned },
    include: {
      author: { select: authorSelect },
      _count: { select: { replies: true } },
    },
  });
  return { post: toPost(post), previousPinned: existing.pinned };
}

export async function deleteAnnouncement(params: { id: string; hospitalId: string }) {
  const existing = await prisma.hospitalAnnouncement.findFirst({
    where: { id: params.id, hospitalId: params.hospitalId },
  });
  if (!existing) return { error: "Announcement not found.", status: 404 as const };

  await prisma.hospitalAnnouncement.delete({ where: { id: existing.id } });
  return { ok: true as const, post: existing };
}

export async function createReply(params: {
  announcementId: string;
  hospitalId: string;
  authorId: string;
  authorName: string;
  body: string;
}) {
  const announcement = await prisma.hospitalAnnouncement.findFirst({
    where: { id: params.announcementId, hospitalId: params.hospitalId },
    select: { id: true, title: true, authorId: true },
  });
  if (!announcement) return { error: "Announcement not found.", status: 404 as const };

  const reply = await prisma.hospitalAnnouncementReply.create({
    data: {
      announcementId: announcement.id,
      authorId: params.authorId,
      body: params.body,
    },
    include: { author: { select: authorSelect } },
  });

  if (announcement.authorId !== params.authorId) {
    await notifyUser({
      hospitalId: params.hospitalId,
      userId: announcement.authorId,
      title: "Reply on hospital chat",
      body: `${params.authorName} replied to “${announcement.title}”.`,
      href: "/",
    });
  }

  return { reply };
}

export async function deleteReply(params: {
  announcementId: string;
  replyId: string;
  hospitalId: string;
}) {
  const reply = await prisma.hospitalAnnouncementReply.findFirst({
    where: {
      id: params.replyId,
      announcementId: params.announcementId,
      announcement: { hospitalId: params.hospitalId },
    },
  });
  if (!reply) return { error: "Reply not found.", status: 404 as const };

  await prisma.hospitalAnnouncementReply.delete({ where: { id: reply.id } });
  return { ok: true as const, reply };
}
