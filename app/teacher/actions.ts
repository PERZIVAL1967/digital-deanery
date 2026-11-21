"use server";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { importMarks, type Mark } from "../../lib/changes/teacher-grades";
import { addAssessment, markAttendance, markRestPresent, setMark } from "../../lib/changes/teacher";
import { actionToken, UUID } from "../../lib/guard";
import { isDay } from "../../lib/time";
import { readMarks } from "./workbook";

const text = (form: FormData, k: string) => String(form.get(k) ?? "").trim().replace(/\s+/g, " ");

/** one tap per student and class; the class must be the signed-in teacher's (checked in SQL) */
export async function mark(form: FormData) {
  const token = await actionToken("teacher");
  const occ = String(form.get("occ") ?? ""), student = String(form.get("student") ?? ""), status = String(form.get("status") ?? "");
  if (!UUID.test(occ) || !UUID.test(student) || !["present", "absent", "late"].includes(status)) notFound();
  if ((await markAttendance(token, occ, student, status as "present" | "absent" | "late")) === "missing") notFound();
  revalidatePath("/", "layout");
  redirect(`/teacher/classes/${occ}?m=${student}`);
}

export async function markRest(form: FormData) {
  const token = await actionToken("teacher");
  const occ = String(form.get("occ") ?? "");
  if (!UUID.test(occ)) notFound();
  if ((await markRestPresent(token, occ)) === "missing") notFound();
  revalidatePath("/", "layout");
  redirect(`/teacher/classes/${occ}?all=1`);
}

export async function addColumn(form: FormData) {
  const token = await actionToken("teacher");
  const section = String(form.get("section") ?? ""), title = text(form, "title"), day = String(form.get("day") ?? "");
  if (!UUID.test(section)) notFound();
  if (!title || title.length > 80 || !isDay(day)) redirect(`/teacher/journal/${section}?error=column`);
  if ((await addAssessment(token, section, title, day)) === "missing") notFound();
  revalidatePath("/", "layout");
  redirect(`/teacher/journal/${section}?ok=column`);
}

/** a journal cell: an empty cell is published at once; a published one goes to the dean with a reason */
export async function cell(form: FormData) {
  const token = await actionToken("teacher");
  const section = String(form.get("section") ?? ""), a = String(form.get("a") ?? ""), s = String(form.get("s") ?? "");
  const score = String(form.get("score") ?? "").trim();
  const reason = text(form, "reason").slice(0, 500) || null;
  if (!UUID.test(section) || !UUID.test(a) || !UUID.test(s)) notFound();
  const base = `/teacher/journal/${section}`;
  if (!score) redirect(base);
  if (!/^\d{1,3}$/.test(score) || Number(score) > 100) redirect(`${base}?error=score&cell=${a}.${s}`);
  const r = await setMark(token, a, s, Number(score), reason);
  if (r === "missing") notFound();
  revalidatePath("/", "layout");
  if (r === "reason") redirect(`${base}?fix=${a}.${s}&v=${score}`);
  redirect(`${base}?${r === "ok" ? `ok=mark&cell=${a}.${s}` : r === "proposed" ? "ok=proposed" : r === "pending" ? "error=pending" : "error=same"}`);
}

export async function importExcel(form: FormData) {
  const token = await actionToken("teacher");
  const section = String(form.get("section") ?? "");
  if (!UUID.test(section)) redirect("/teacher/journal?import=scope");
  const file = form.get("workbook");
  let marks: Mark[];
  try {
    if (!(file instanceof File)) throw new Error("Missing file");
    marks = await readMarks(file);
  } catch {
    redirect(`/teacher/journal/${section}?import=invalid`);
  }
  const status = await importMarks(token, section, marks);
  revalidatePath("/", "layout");
  redirect(`/teacher/journal/${section}?import=${status}`);
}
