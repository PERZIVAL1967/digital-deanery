"use server";

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { submitRequest, transitionRequest } from "../../../../lib/changes/requests";
import { requestIdByKey } from "../../../../lib/changes/cifry";
import { actionToken, UUID } from "../../../../lib/guard";
import { kinds, statuses, type Status } from "../../../../lib/request-types";
import { isCertificate } from "../../../../lib/request-ui";

const WHERE = ["По месту требования", "В посольство", "В банк", "Работодателю", "В военкомат"];
const LANG = ["Русский", "Английский"];

/** Codex's submitRequest with an idempotency key: a double tap creates one request. */
export async function submit(form: FormData) {
  const token = await actionToken("student");
  const key = String(form.get("key") ?? "");
  const kind = String(form.get("kind") ?? "");
  if (!Object.hasOwn(kinds, kind)) notFound();
  if (!UUID.test(key)) redirect(`/requests/new/${kind}?error=stale`);
  const comment = String(form.get("comment") ?? "").trim().replace(/\s+/g, " ");
  const lines: string[] = [];
  if (isCertificate(kind)) {
    const where = String(form.get("where") ?? "");
    const copies = Number(form.get("copies") ?? "1");
    const lang = String(form.get("lang") ?? "Русский");
    if (!WHERE.includes(where) || !Number.isInteger(copies) || copies < 1 || copies > 5 || !LANG.includes(lang)) {
      redirect(`/requests/new/${kind}?error=fields`);
    }
    lines.push(`Куда: ${where}`, `Экземпляров: ${copies}`, `Язык: ${lang}`);
  } else if (!comment) {
    redirect(`/requests/new/${kind}?error=comment`);
  }
  if (comment.length > 1000) redirect(`/requests/new/${kind}?error=long`);
  if (comment) lines.push(`Комментарий: ${comment}`);
  await submitRequest(token, key, kind, lines.join("\n"));
  const id = await requestIdByKey(token, key);
  if (!id) redirect("/requests");
  revalidatePath("/", "layout");
  redirect(`/requests/done/${id}`);
}

/** the student's side of Codex's transitions: withdraw a submitted request, answer a «needs info» one */
export async function studentChange(form: FormData) {
  const token = await actionToken("student");
  const id = String(form.get("id") ?? "");
  const version = String(form.get("version") ?? "");
  const next = String(form.get("next") ?? "");
  const message = String(form.get("message") ?? "").trim();
  if (!UUID.test(id)) notFound();
  if (!/^\d{1,9}$/.test(version) || !Object.hasOwn(statuses, next) || message.length > 2000 || (next === "in_review" && !message)) {
    redirect(`/requests/${id}?error=1`);
  }
  const result = await transitionRequest(token, "student", id, Number(version), next as Status, message || (next === "withdrawn" ? "Отозвана студентом." : ""));
  if (result === "missing") notFound();
  revalidatePath("/", "layout");
  redirect(`/requests/${id}${result === "conflict" ? "?error=1" : ""}`);
}

