import { calendar } from "../../../lib/dal/calendar";

function escape(value: string) {
  return value.replaceAll("\\", "\\\\").replace(/\r\n|\r|\n/g, "\\n")
    .replaceAll(",", "\\,").replaceAll(";", "\\;");
}

function stamp(date: Date) {
  return date.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

function fold(line: string) {
  let bytes = 0;
  let output = "";
  for (const character of line) {
    const size = Buffer.byteLength(character);
    if (bytes + size > 75) {
      output += "\r\n ";
      bytes = 1;
    }
    output += character;
    bytes += size;
  }
  return output;
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const path = (await params).token;
  if (!/^[a-f0-9]{64}\.ics$/.test(path)) return new Response(null, { status: 404 });
  const classes = await calendar(path.slice(0, -4));
  const headers = { "Cache-Control": "private, no-store" };
  if (!classes) return new Response(null, { status: 404, headers });
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Digital Deanery//Timetable//RU", "CALSCALE:GREGORIAN"];
  for (const item of classes) {
    lines.push(
      "BEGIN:VEVENT", `UID:${item.id}@digital-deanery`, `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(item.starts_at)}`, `DTEND:${stamp(item.ends_at)}`,
      `SEQUENCE:${item.version}`, `STATUS:${item.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      `SUMMARY:${escape(item.course + " - " + item.section)}`,
      `LOCATION:${escape(item.room)}`, "END:VEVENT",
    );
  }
  return new Response(lines.map(fold).join("\r\n") + "\r\nEND:VCALENDAR\r\n", {
    headers: { ...headers, "Content-Type": "text/calendar; charset=utf-8" },
  });
}
