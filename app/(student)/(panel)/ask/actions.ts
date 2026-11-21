"use server";
import { redirect } from "next/navigation";
import { askQuestion } from "../../../../lib/changes/cifry";
import { actionToken, UUID } from "../../../../lib/guard";

const TOPICS = ["timetable", "documents", "stipend", "other"];

export async function ask(form: FormData) {
  const token = await actionToken("student");
  const key = String(form.get("key") ?? "");
  const topic = String(form.get("topic") ?? "");
  const body = String(form.get("body") ?? "").trim();
  if (!UUID.test(key) || !TOPICS.includes(topic)) redirect("/ask?error=topic");
  if (!body) redirect("/ask?error=empty");
  if (body.length > 2000) redirect("/ask?error=long");
  if (!(await askQuestion(token, key, topic, body))) redirect("/login");
  redirect("/ask?sent=1");
}
