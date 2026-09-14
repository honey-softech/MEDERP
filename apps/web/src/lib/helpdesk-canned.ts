export function renderCannedReply(
  template: string,
  vars: {
    ticket_number?: string | null;
    requester_name?: string | null;
    agent_name?: string | null;
    hospital_name?: string | null;
  },
) {
  return template
    .replaceAll("{{ticket_number}}", vars.ticket_number ?? "")
    .replaceAll("{{requester_name}}", vars.requester_name ?? "")
    .replaceAll("{{agent_name}}", vars.agent_name ?? "")
    .replaceAll("{{hospital_name}}", vars.hospital_name ?? "");
}
