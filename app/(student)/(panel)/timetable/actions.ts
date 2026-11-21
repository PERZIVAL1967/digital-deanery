"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { rotateCalendarToken } from "../../../../lib/changes/calendar";
import { digest } from "../../../../lib/dal/session";
import { actionToken, cookieSecure } from "../../../../lib/guard";
import { isDay } from "../../../../lib/time";

/** Codex's calendar token: a private ICS link; shown once via a short-lived cookie bound to this session */
export async function subscribeCalendar(form: FormData) {
  const session = await actionToken("student");
  const d = String(form.get("d") ?? "");
  const token = await rotateCalendarToken(session);
  if (!token) redirect("/login");
  (await cookies()).set("calendar_preview", digest(session) + "." + token, {
    httpOnly: true, sameSite: "lax", secure: cookieSecure(), maxAge: 300, path: "/timetable",
  });
  redirect(`/timetable?${isDay(d) ? `d=${d}&` : ""}cal=1`);
}
