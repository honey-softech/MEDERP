import { describe, expect, it } from "vitest";
import { slaDueDates, slaState } from "@/lib/helpdesk-sla";
import { buildTicketQuery } from "@/lib/helpdesk-queue";
import { renderCannedReply } from "@/lib/helpdesk-canned";

describe("helpdesk-sla", () => {
  it("computes due dates from priority", () => {
    const from = new Date("2026-09-14T10:00:00.000Z");
    const high = slaDueDates("HIGH", from);
    expect(high.firstResponseDueAt.toISOString()).toBe("2026-09-14T11:00:00.000Z");
    expect(high.resolutionDueAt.toISOString()).toBe("2026-09-15T10:00:00.000Z");
  });

  it("marks first-response breach when unanswered past due", () => {
    const state = slaState({
      status: "OPEN",
      firstResponseDueAt: new Date(Date.now() - 60 * 60_000),
      resolutionDueAt: new Date(Date.now() + 24 * 60 * 60_000),
      firstResponseAt: null,
      resolvedAt: null,
    });
    expect(state.tone).toBe("breached");
    expect(state.kind).toBe("firstResponse");
  });

  it("switches to resolution clock after first response", () => {
    const state = slaState({
      status: "IN_PROGRESS",
      firstResponseDueAt: new Date(Date.now() - 60 * 60_000),
      resolutionDueAt: new Date(Date.now() + 3 * 60 * 60_000),
      firstResponseAt: new Date(),
      resolvedAt: null,
    });
    expect(state.kind).toBe("resolution");
    expect(state.tone).toBe("ok");
  });
});

describe("helpdesk-queue", () => {
  it("builds needs-action view for handlers", () => {
    const query = buildTicketQuery(
      { id: "agent-1", role: "HELPDESK", hospitalId: null },
      { view: "needs-action", page: "1" },
    );
    expect(query.view).toBe("needs-action");
    expect(query.take).toBe(50);
    expect(query.where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([
          {},
          { status: { in: ["OPEN", "IN_PROGRESS", "ESCALATED"] } },
        ]),
      }),
    );
  });

  it("scopes non-handlers to their own tickets", () => {
    const query = buildTicketQuery(
      { id: "user-1", role: "DOCTOR", hospitalId: "h1" },
      { view: "all" },
    );
    expect(query.where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([{ createdById: "user-1" }]),
      }),
    );
  });
});

describe("helpdesk-canned", () => {
  it("substitutes template variables", () => {
    const text = renderCannedReply(
      "Hi {{requester_name}}, ticket {{ticket_number}} at {{hospital_name}} — {{agent_name}}",
      {
        requester_name: "Ravi",
        ticket_number: "HD-000001",
        hospital_name: "City Clinic",
        agent_name: "Ada",
      },
    );
    expect(text).toBe("Hi Ravi, ticket HD-000001 at City Clinic — Ada");
  });
});
