// Generate an .ics calendar file for a learning plan
export function planToIcs(opts: {
  title: string;
  days: number;
  startDate?: Date;
  planId: string;
  appUrl?: string;
}): string {
  const start = opts.startDate ?? new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KE-FORGE LEARN//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (let i = 0; i < opts.days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    d.setHours(18, 0, 0, 0);
    const end = new Date(d);
    end.setMinutes(end.getMinutes() + 45);
    const url = opts.appUrl ? `${opts.appUrl}/learn/${opts.planId}` : "";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${opts.planId}-day-${i + 1}@ke-forge-learn`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(d)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:Day ${i + 1} — ${escapeIcs(opts.title)}`,
      `DESCRIPTION:Study session for "${escapeIcs(opts.title)}" (Day ${i + 1} of ${opts.days}).${url ? `\\n${url}` : ""}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT15M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Study reminder",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function escapeIcs(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
