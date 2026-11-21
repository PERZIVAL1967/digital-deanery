// One-tap certificates: a simple «Справка об обучении» as a PDF, built from the student's record.
// pdf-lib + fontkit with Golos Text (OFL, assets/fonts) for Cyrillic. The template is fictional: no university name,
// no logo, and a line that says it is a concept document without legal force.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export type CertificateData = {
  number: string; issuedOn: string; name: string; birthDate: string | null; courseYear: number | null; studyForm: string | null;
  level: string | null; programme: string; profile: string | null; faculty: string; group: string; recordBook: string | null;
  admissionYear: number | null; status: string | null; destination: string | null;
};

let fonts: Promise<[Uint8Array, Uint8Array]> | null = null;
const loadFonts = () => (fonts ??= Promise.all(["GolosText_400Regular.ttf", "GolosText_700Bold.ttf"]
  .map((f) => readFile(path.join(process.cwd(), "assets", "fonts", f)).then((b) => new Uint8Array(b)))) as Promise<[Uint8Array, Uint8Array]>);

/** wraps `text` to `width` and draws it; returns the y below the paragraph */
function para(page: PDFPage, text: string, font: PDFFont, size: number, x: number, y: number, width: number, lead = size * 1.45) {
  const words = text.split(/\s+/);
  let line = "";
  for (const w of words) {
    const next = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      page.drawText(line, { x, y, size, font, color: rgb(0.06, 0.08, 0.19) });
      y -= lead;
      line = w;
    } else line = next;
  }
  if (line) { page.drawText(line, { x, y, size, font, color: rgb(0.06, 0.08, 0.19) }); y -= lead; }
  return y;
}

export async function certificatePdf(d: CertificateData) {
  const [regular, bold] = await loadFonts();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Справка об обучении ${d.number}`);
  doc.setAuthor("Цифровой деканат (учебный концепт)");
  doc.setCreator("Цифровой деканат");
  const f = await doc.embedFont(regular, { subset: true });
  const b = await doc.embedFont(bold, { subset: true });
  const page = doc.addPage([595.28, 841.89]); // A4
  const L = 64, W = 595.28 - 2 * L;
  let y = 780;
  page.drawText("ЦИФРОВОЙ ДЕКАНАТ", { x: L, y, size: 10, font: b, color: rgb(0.2, 0.25, 0.42) });
  page.drawText("учебный концепт, не официальный документ", { x: L, y: y - 14, size: 9, font: f, color: rgb(0.3, 0.35, 0.52) });
  page.drawText(`Факультет ${d.faculty}`, { x: L, y: y - 28, size: 9, font: f, color: rgb(0.3, 0.35, 0.52) });
  page.drawRectangle({ x: L, y: y - 40, width: W, height: 1.2, color: rgb(1, 0.62, 0.78) });
  y -= 100;
  const title = "СПРАВКА ОБ ОБУЧЕНИИ";
  page.drawText(title, { x: L + (W - b.widthOfTextAtSize(title, 18)) / 2, y, size: 18, font: b });
  y -= 22;
  const no = `№ ${d.number} от ${d.issuedOn}`;
  page.drawText(no, { x: L + (W - f.widthOfTextAtSize(no, 11)) / 2, y, size: 11, font: f });
  y -= 44;
  const course = d.courseYear ? `на ${d.courseYear} курсе` : "";
  y = para(page, `Настоящим подтверждается, что ${d.name}${d.birthDate ? ` (дата рождения: ${d.birthDate})` : ""} действительно обучается ${course} ` +
    `по ${(d.studyForm ?? "очной").toLowerCase().replace(/ая$/, "ой")} форме обучения на факультете ${d.faculty}.`, f, 12, L, y, W);
  y -= 8;
  const rows: [string, string | null][] = [
    ["Уровень образования", d.level], ["Направление подготовки", d.programme], ["Профиль", d.profile], ["Академическая группа", d.group],
    ["Номер зачётной книжки", d.recordBook], ["Год поступления", d.admissionYear ? String(d.admissionYear) : null],
    ["Статус обучения", d.status], ["Справка выдана для предоставления", d.destination ?? "по месту требования"],
  ];
  for (const [k, v] of rows) {
    if (!v) continue;
    page.drawText(k, { x: L, y, size: 10, font: f, color: rgb(0.3, 0.35, 0.52) });
    y = para(page, v, b, 11, L + 210, y, W - 210, 15) - 6;
  }
  y -= 40;
  page.drawText("Деканат факультета", { x: L, y, size: 11, font: f });
  page.drawText("_____________________", { x: L + 250, y, size: 11, font: f });
  page.drawText("М. П.", { x: L + 250, y: y - 30, size: 10, font: f, color: rgb(0.3, 0.35, 0.52) });
  para(page, "Документ сформирован автоматически в учебном концепте «Цифровой деканат» для конкурса. Все данные вымышленные, " +
    "документ не имеет юридической силы.", f, 8.5, L, 70, W, 12);
  return Buffer.from(await doc.save());
}
