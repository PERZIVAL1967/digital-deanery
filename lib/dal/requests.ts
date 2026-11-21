import { db } from "../db";
import { digest } from "./session";
import type { kinds, Mode, Status } from "../request-types";

export const requestScope = `
  FROM session
  JOIN request ON true
  JOIN student ON student.id = request.student_id
  JOIN acad_group ON acad_group.id = student.group_id
  JOIN programme ON programme.id = acad_group.programme_id
  WHERE session.token_hash = $1 AND session.expires_at > now()
  AND (($2 = 'student' AND session.user_id = student.id)
    OR ($2 = 'staff' AND EXISTS (
      SELECT 1 FROM staff WHERE staff.id = session.user_id
      AND staff.faculty_id = programme.faculty_id
    )))`;

type RequestRow = {
  id: string; name: string; kind: keyof typeof kinds; status: Status;
  version: number; message: string;
};

export async function requests(token: string, mode: Mode, id?: string) {
  const result = await db.query<RequestRow>(
    `SELECT request.*, student.name ${requestScope}
     AND ($3::uuid IS NULL OR request.id = $3)
     ORDER BY request.created_at DESC, request.id`,
    [digest(token), mode, id ?? null],
  );
  return result.rows;
}

export async function history(token: string, mode: Mode, id: string) {
  const result = await db.query<{ status: Status; message: string; version: number }>(
    `SELECT event.status, event.message, event.version FROM request_event event
     WHERE event.request_id IN (SELECT request.id ${requestScope} AND request.id = $3)
     ORDER BY event.version`,
    [digest(token), mode, id],
  );
  return result.rows;
}
