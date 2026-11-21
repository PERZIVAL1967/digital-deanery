import { db } from "../db";
import { digest } from "./session";

export async function calendar(token: string) {
  const result = await db.query<{
    id: string | null; starts_at: Date; ends_at: Date; version: number;
    status: string; course: string; section: string; room: string;
  }>(
    `SELECT occurrence.id, lower(occurrence.slot) AS starts_at,
            upper(occurrence.slot) AS ends_at, occurrence.version,
            occurrence.status, course.name AS course, section.label AS section, room.name AS room
     FROM calendar_token
     LEFT JOIN section_member ON section_member.student_id = calendar_token.student_id
     LEFT JOIN section ON section.id = section_member.section_id
     LEFT JOIN course ON course.id = section.course_id
     LEFT JOIN class_occurrence occurrence ON occurrence.section_id = section.id
     LEFT JOIN room ON room.id = occurrence.room_id
     WHERE token_hash = $1 ORDER BY lower(occurrence.slot), occurrence.id`,
    [digest(token)],
  );
  if (!result.rows.length) return null;
  return result.rows.filter((row) => row.id !== null);
}
