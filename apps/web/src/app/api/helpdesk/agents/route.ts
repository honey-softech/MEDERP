import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canHandleHelpdesk } from "@/lib/helpdesk";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!canHandleHelpdesk(user.role)) {
    return NextResponse.json({ error: "Helpdesk access required." }, { status: 403 });
  }

  const agents = await prisma.appUser.findMany({
    where: {
      role: { in: ["SOFTWARE_ADMIN", "HELPDESK"] },
      isActive: true,
      isVerified: true,
    },
    select: {
      id: true,
      username: true,
      role: true,
      firstName: true,
      lastName: true,
      _count: {
        select: {
          assignedTickets: {
            where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_REPLY", "ESCALATED"] } },
          },
        },
      },
    },
    orderBy: [{ role: "asc" }, { username: "asc" }],
  });

  return NextResponse.json({
    agents: agents.map((agent) => ({
      id: agent.id,
      username: agent.username,
      role: agent.role,
      displayName:
        [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim() || agent.username,
      openCount: agent._count.assignedTickets,
    })),
  });
}
