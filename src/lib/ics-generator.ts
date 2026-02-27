/**
 * Generate .ics calendar file for guest invitation.
 */
export function generateInviteIcs(params: {
  programName: string;
  topic: string;
  recordDate: string;
  recordTime: string;
  studioAddress?: string;
}): string {
  const { programName, topic, recordDate, recordTime, studioAddress } = params;
  const dateStr = recordDate || "TBD";
  const timeStr = recordTime || "TBD";

  let dtStart = "";
  let dtEnd = "";
  if (dateStr !== "TBD" && timeStr !== "TBD") {
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const [hh, mm] = timeStr.split(":").map(Number);
      const start = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 10, mm ?? 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      dtStart = start.toISOString().replace(/[-:]/g, "").slice(0, 15);
      dtEnd = end.toISOString().replace(/[-:]/g, "").slice(0, 15);
    } catch {
      // ignore
    }
  }

  const summary = `TRT World: ${programName}`;
  const description = `Invitation to participate in ${programName}${topic ? ` (${topic})` : ""}. Broadcast on TRT World.`;
  const location = studioAddress || "";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TRT World//Guest Invitation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@trtworld.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
  ];
  if (dtStart && dtEnd) {
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
  }
  lines.push(`SUMMARY:${escapeIcs(summary)}`);
  lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  if (location) lines.push(`LOCATION:${escapeIcs(location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
