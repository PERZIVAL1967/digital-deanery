import { db } from "../db";
import { digest } from "../dal/session";
import { DatabaseError } from "pg";

export async function changeClass(token: string, id: string, version: number,
  start: string | null, end: string | null, reason: string, roomName: string | null) {
  try {
    const result = await db.query<{ changed: boolean; visible: boolean }>(
      `WITH target AS (
        SELECT occurrence.*, room.name AS room
        FROM session JOIN staff ON staff.id = session.user_id
        JOIN course ON course.faculty_id = staff.faculty_id
        JOIN section ON section.course_id = course.id
        JOIN class_occurrence occurrence ON occurrence.section_id = section.id
        JOIN room ON room.id = occurrence.room_id
        WHERE session.token_hash = $1 AND session.expires_at > now()
          AND occurrence.id = $2
        FOR UPDATE OF occurrence
      ), chosen_room AS (
        INSERT INTO room (name)
        SELECT $7 FROM target WHERE $7::text IS NOT NULL
          AND target.version = $3 AND target.status <> 'cancelled'
          AND (target.room <> $7 OR target.slot <> tstzrange($4, $5, '[)'))
        ON CONFLICT (name) DO UPDATE SET name = excluded.name
        RETURNING id, name
      ), updated AS (
        UPDATE class_occurrence occurrence SET
          slot = CASE WHEN $4::timestamptz IS NULL THEN target.slot ELSE tstzrange($4, $5, '[)') END,
          room_id = COALESCE((SELECT id FROM chosen_room), target.room_id),
          original_slot = COALESCE(target.original_slot, target.slot),
          original_room_id = COALESCE(target.original_room_id, target.room_id),
          status = CASE WHEN $4::timestamptz IS NULL THEN 'cancelled' ELSE 'moved' END,
          version = target.version + 1
        FROM target WHERE occurrence.id = target.id AND target.version = $3
          AND target.status <> 'cancelled'

          AND ($4::timestamptz IS NULL OR target.slot <> tstzrange($4, $5, '[)') OR target.room <> $7)
        RETURNING occurrence.id, occurrence.section_id, occurrence.status,
          lower(target.slot) AS before_start, upper(target.slot) AS before_end,
          lower(occurrence.slot) AS after_start, upper(occurrence.slot) AS after_end, target.room AS before_room, COALESCE((SELECT name FROM chosen_room), target.room) AS after_room
      ), event AS (
        INSERT INTO change_event (kind,entity_id,payload)
        SELECT 'class_status', updated.id,
          jsonb_build_object('status', updated.status, 'course', course.name, 'section', section.label,
          'beforeStart', updated.before_start, 'beforeEnd', updated.before_end,
          'afterStart', updated.after_start, 'afterEnd', updated.after_end,
          'room', updated.after_room, 'beforeRoom', updated.before_room, 'reason', $6::text)
        FROM updated JOIN section ON section.id = updated.section_id
        JOIN course ON course.id = section.course_id

        RETURNING id, entity_id
      ), recipients AS (
        INSERT INTO notification (change_event_id,student_id)
        SELECT event.id, member.student_id FROM event
        JOIN updated ON updated.id = event.entity_id
        JOIN section_member member ON member.section_id = updated.section_id
      )
      SELECT EXISTS (SELECT 1 FROM updated) AS changed, EXISTS (SELECT 1 FROM target) AS visible`,
      [digest(token), id, version, start, end, reason, roomName],
    );
    const row = result.rows[0];
    return row.changed ? "ok" : row.visible ? "stale" : "missing";
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "23P01") return "overlap";
    throw error;
  }
}
