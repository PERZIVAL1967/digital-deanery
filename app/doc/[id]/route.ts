// A generated document (one-tap certificate) as a PDF. Authorised in SQL: the student it belongs to, or deanery staff
// of that student's faculty. Anyone else gets the same 404 as for a missing id.
import { cookies } from "next/headers";
import { sessionCookie } from "../../../lib/dal/session";
import { documentPdf } from "../../../lib/dal/staff";

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(sessionCookie)?.value;
  const { id } = await params;
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !UUID.test(id)) return new Response("Нет доступа", { status: 404 });
  const doc = await documentPdf(token, id);
  if (!doc) return new Response("Нет доступа", { status: 404 });
  return new Response(new Uint8Array(doc.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="spravka-${doc.number.replace(/[^0-9a-z-]/gi, "")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
