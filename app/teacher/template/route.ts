import ExcelJS from "exceljs";
import { cookies } from "next/headers";
import { importRoster } from "../../../lib/dal/teacher-grades";
import { sessionCookie } from "../../../lib/dal/session";

export async function GET(request: Request) {
  const token = (await cookies()).get(sessionCookie)?.value;
  const section = new URL(request.url).searchParams.get("section");
  if (!token || !section || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(section)) {
    return new Response(null, { status: 404 });
  }
  const roster = await importRoster(token, section);
  if (!roster.length) return new Response(null, { status: 404 });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Marks");
  sheet.columns = [{ header: "login", width: 24 }, { header: "score", width: 12 }, { header: "Студент", width: 32 }];
  for (const student of roster) sheet.addRow([student.login, null, student.name]);
  const data = await workbook.xlsx.writeBuffer();
  return new Response(Uint8Array.from(new Uint8Array(data)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="deanery-marks.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
