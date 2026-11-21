"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { uploadPlagiarism } from "../../../../lib/changes/cifry";
import { actionToken, UUID } from "../../../../lib/guard";

const ALLOWED = /\.(docx?|pdf|odt|rtf|txt)$/i;
const MAX = 4 * 1024 * 1024;

/** Simulated upload: the file is never read or stored; only its name is kept and a deterministic score is given. */
export async function uploadWork(form: FormData) {
  const token = await actionToken("student");
  const id = String(form.get("work") ?? "");
  const file = form.get("file");
  if (!UUID.test(id)) redirect("/plagiarism?error=work");
  if (!(file instanceof File) || !file.name || file.size === 0) redirect(`/plagiarism?error=file&w=${id}`);
  const name = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(-120);
  if (!ALLOWED.test(name)) redirect(`/plagiarism?error=type&w=${id}`);
  if (file.size > MAX) redirect(`/plagiarism?error=size&w=${id}`);
  const result = await uploadPlagiarism(token, id, name);
  if (!result) redirect("/plagiarism?error=work");
  revalidatePath("/", "layout");
  redirect(`/plagiarism?done=${id}`);
}
