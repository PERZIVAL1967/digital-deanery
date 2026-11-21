"use server";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { transitionRequest } from "../../lib/changes/requests";
import { changeClass } from "../../lib/changes/classes";
import { answerQuestion } from "../../lib/changes/cifry";
import { deanSetGrade, excuseAbsence, oneTapCertificate, publishTargeted } from "../../lib/changes/staff";
import { actionToken, UUID } from "../../lib/guard";
import { statuses, type Status } from "../../lib/request-types";
import { isDay } from "../../lib/time";

/** Codex's transitionRequest in staff mode (faculty scope, optimistic version check, notification to the student) */
export async function moveRequest(form: FormData) {
  const token = await actionToken("staff");
  const id = String(form.get("id") ?? "");
  const version = String(form.get("version") ?? "");
  const next = String(form.get("next") ?? "");
  const message = String(form.get("message") ?? "").trim();
  if (!UUID.test(id)) notFound();
  const url = `/staff/requests/${id}`;
  if (!/^\d{1,9}$/.test(version) || !Object.hasOwn(statuses, next) || message.length > 2000) redirect(url + "?error=invalid");
  if ((next === "rejected" || next === "needs_info") && !message) redirect(url + "?error=reason");
  const result = await transitionRequest(token, "staff", id, Number(version), next as Status, message);
  if (result === "missing") notFound();
  revalidatePath("/", "layout");
  redirect(url + (result === "conflict" ? "?error=conflict" : "?ok=1"));
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Codex's changeClass: move (new time and/or room) or cancel; the students of the section are notified */
export async function editClass(form: FormData) {
  const token = await actionToken("staff");
  const id = String(form.get("id") ?? "");
  const version = String(form.get("version") ?? "");
  const mode = String(form.get("mode") ?? "");
  const back = String(form.get("back") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  const base = `/staff/timetable?d=${isDay(back) ? back : ""}`;
  if (!UUID.test(id)) notFound();
  if (!/^\d{1,9}$/.test(version) || reason.length > 1000) redirect(`${base}&err=invalid&c=${id}`);
  if (!reason) redirect(`${base}&err=reason&c=${id}`);
  let start: string | null = null, end: string | null = null, room: string | null = null;
  if (mode === "move") {
    const day = String(form.get("day") ?? "");
    const from = String(form.get("start") ?? ""), to = String(form.get("end") ?? "");
    room = String(form.get("room") ?? "").trim().replace(/\s+/g, " ");
    if (!isDay(day) || !TIME.test(from) || !TIME.test(to) || from >= to || !room || room.length > 60) redirect(`${base}&err=invalid&c=${id}`);
    start = `${day} ${from}:00+03:00`;
    end = `${day} ${to}:00+03:00`;
  } else if (mode !== "cancel") {
    redirect(`${base}&err=invalid&c=${id}`);
  }
  const result = await changeClass(token, id, Number(version), start, end, reason, room);
  if (result === "missing") notFound();
  revalidatePath("/", "layout");
  redirect(`${base}&res=${result}&c=${id}`);
}

/** news for the faculty, a поток, a group or a language group; the id is generated with the form (double submit = once) */
export async function publishNews(form: FormData) {
  const token = await actionToken("staff");
  const id = String(form.get("id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const [scope, target] = String(form.get("to") ?? "faculty").split(":");
  if (!UUID.test(id)) redirect("/staff/news?error=stale");
  if (!title || title.length > 120) redirect("/staff/news?error=title");
  if (!body || body.length > 2000) redirect("/staff/news?error=body");
  if (!["faculty", "stream", "group", "section"].includes(scope) || (scope !== "faculty" && !UUID.test(target ?? ""))) redirect("/staff/news?error=to");
  if ((await publishTargeted(token, id, title, body, scope, scope === "faculty" ? null : target)) === "missing") notFound();
  revalidatePath("/", "layout");
  redirect("/staff/news?ok=1");
}

export async function answer(form: FormData) {
  const token = await actionToken("staff");
  const id = String(form.get("id") ?? "");
  const text = String(form.get("answer") ?? "").trim();
  if (!UUID.test(id)) notFound();
  if (!text || text.length > 2000) redirect(`/staff/questions?error=${id}`);
  const result = await answerQuestion(token, id, text);
  if (result === "missing") notFound();
  revalidatePath("/", "layout");
  redirect(`/staff/questions?${result === "ok" ? "ok=1" : "stale=1"}`);
}

// ---------- one-tap certificate, teacher requests ----------
export async function oneTap(form: FormData) {
  const token = await actionToken("staff");
  const id = String(form.get("id") ?? "");
  const pickup = String(form.get("pickup") ?? "").trim().slice(0, 300) || "Можно забрать в деканате, каб. 210.";
  if (!UUID.test(id)) notFound();
  const r = await oneTapCertificate(token, id, pickup);
  if (r === "missing") notFound();
  revalidatePath("/", "layout");
  redirect(`/staff/requests/${id}?${r === "ok" ? "ok=pdf" : "error=" + r}`);
}

// ---------- the student card: every edit needs a reason and is logged ----------
const reasonOf = (form: FormData) => String(form.get("reason") ?? "").trim().replace(/\s+/g, " ");
const card = (id: string, q: string) => `/staff/students/${id}?${q}`;
const RES = (r: string) => (r === "ok" ? "ok=1" : `error=${r}`);

export async function excuse(form: FormData) {
  const token = await actionToken("staff");
  const student = String(form.get("student") ?? ""), occurrence = String(form.get("occurrence") ?? "");
  const note = reasonOf(form);
  if (!UUID.test(student) || !UUID.test(occurrence)) notFound();
  if (!note || note.length > 300) redirect(card(student, "error=reason&f=excuse"));
  const r = await excuseAbsence(token, student, occurrence, note);
  if (r === "missing") notFound();
  revalidatePath("/", "layout");
  redirect(card(student, RES(r)) + "#absences");
}

export async function setGrade(form: FormData) {
  const token = await actionToken("staff");
  const student = String(form.get("student") ?? ""), course = String(form.get("course") ?? "");
  const score = String(form.get("score") ?? "").trim();
  const reason = reasonOf(form);
  if (!UUID.test(student) || !UUID.test(course)) notFound();
  if (!/^\d{1,3}$/.test(score) || Number(score) > 100) redirect(card(student, "error=score") + "#grades");
  if (!reason || reason.length > 500) redirect(card(student, `error=reason&f=grade-${course}`) + "#grades");
  const r = await deanSetGrade(token, student, course, Number(score), reason);
  if (r === "missing") notFound();
  revalidatePath("/", "layout");
  redirect(card(student, RES(r)) + "#grades");
}
