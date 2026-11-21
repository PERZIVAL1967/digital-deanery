import { db } from "../db";
import { digest } from "./session";

export async function timetable(token: string, start: string, end: string) {
  const result = await db.query<{
    id: string; version: number; editable: boolean; course: string; section: string; room: string; room_id: string;
    starts_at: Date; ends_at: Date; original_start: Date | null; original_end: Date | null;
    original_room: string | null; status: "scheduled" | "moved" | "cancelled";
  }>(
    `SELECT occurrence.id, occurrence.version, EXISTS (SELECT 1 FROM staff WHERE id = session.user_id AND faculty_id = course.faculty_id) AS editable, course.name AS course, section.label AS section,
            room.name AS room, room.id AS room_id, lower(occurrence.slot) AS starts_at,
            upper(occurrence.slot) AS ends_at, lower(occurrence.original_slot) AS original_start, upper(occurrence.original_slot) AS original_end,
            old_room.name AS original_room, occurrence.status
     FROM session
     JOIN class_occurrence AS occurrence ON occurrence.slot && tstzrange($2, $3, '[)')
     JOIN section ON section.id = occurrence.section_id
     JOIN course ON course.id = section.course_id
     JOIN room ON room.id = occurrence.room_id
     LEFT JOIN room AS old_room ON old_room.id = occurrence.original_room_id
     WHERE session.token_hash = $1 AND session.expires_at > now()
       AND (
         EXISTS (SELECT 1 FROM section_member
                 WHERE section_id = section.id AND student_id = session.user_id)
         OR EXISTS (SELECT 1 FROM teacher_account
                    WHERE teacher_id = occurrence.teacher_id AND user_id = session.user_id)
         OR EXISTS (SELECT 1 FROM staff
                    WHERE id = session.user_id AND faculty_id = course.faculty_id)
       )
     ORDER BY lower(occurrence.slot), occurrence.id`,
    [digest(token), start, end],
  );
  return result.rows;
}



export async function rooms() {
  return (await db.query<{ id: string; name: string }>("SELECT id, name FROM room ORDER BY name, id")).rows;
}
