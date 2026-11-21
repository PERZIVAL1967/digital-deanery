import { db } from "../db";
import { digest } from "./session";
import type { Status } from "../request-types";

export async function inbox(token: string) {
  const result = await db.query<{
    id: string; entity_id: string; created_at: Date; read_at: Date | null;
    kind: "request_status" | "class_status" | "announcement" | "grade_changed";
    payload: { before: Status | null; after: Status; reason: string; title?: string; body?: string; status?: "moved" | "cancelled";
      course?: string; section?: string; beforeStart?: string; afterStart?: string; beforeEnd?: string; afterEnd?: string; room?: string; beforeRoom?: string; attempt?: number; score?: number; corrected?: boolean };
  }>(
    `SELECT notification.id, notification.read_at, event.entity_id, event.created_at, event.kind, event.payload
     FROM session JOIN notification ON notification.student_id = session.user_id
     JOIN change_event event ON event.id = notification.change_event_id
     WHERE session.token_hash = $1 AND session.expires_at > now()
       AND event.kind IN ('request_status','class_status','announcement','grade_changed')
     ORDER BY event.created_at DESC, notification.id DESC LIMIT 50`,
    [digest(token)],
  );
  return result.rows;
}
