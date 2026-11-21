import { createHash } from "node:crypto";
import { db } from "../db";

export const sessionCookie = "deanery_session";

export function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

type Profile = {
  name: string;
  role: "student" | "teacher" | "staff";
  programme: string | null;
  group_name: string | null;
  faculty: string | null;
};

export async function accountProfiles(token: string) {
  const result = await db.query<Profile>(
    `WITH principal AS (
       SELECT user_id FROM session WHERE token_hash = $1 AND expires_at > now()
     )
     SELECT student.name, 'student' AS role, programme.name AS programme,
            acad_group.name AS group_name, faculty.name AS faculty
     FROM principal JOIN student ON student.id = principal.user_id
     JOIN acad_group ON acad_group.id = student.group_id
     JOIN programme ON programme.id = acad_group.programme_id
     JOIN faculty ON faculty.id = programme.faculty_id
     UNION ALL
     SELECT teacher.name, 'teacher', NULL, NULL, NULL
     FROM principal JOIN teacher_account ON teacher_account.user_id = principal.user_id
     JOIN teacher ON teacher.id = teacher_account.teacher_id
     UNION ALL
     SELECT staff.name, 'staff', NULL, NULL, faculty.name
     FROM principal JOIN staff ON staff.id = principal.user_id
     JOIN faculty ON faculty.id = staff.faculty_id`,
    [digest(token)],
  );
  return result.rows;
}

