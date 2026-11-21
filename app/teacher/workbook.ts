import ExcelJS from "exceljs";
import { fromBuffer } from "yauzl";
import type { Mark } from "../../lib/changes/teacher-grades";

export const maxUploadBytes = 512 * 1024;

function checkArchive(data: Buffer) {
  return new Promise<void>((resolve, reject) => {
    fromBuffer(data, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(error);
      let size = 0;
      let count = 0;
      zip.on("error", reject);
      zip.on("end", resolve);
      zip.on("entry", (entry) => {
        size += entry.uncompressedSize;
        count += 1;
        if (size > 8 * 1024 * 1024 || count > 256) {
          zip.close();
          reject(new Error("Workbook too large"));
        } else {
          zip.readEntry();
        }
      });
      zip.readEntry();
    });
  });
}

export async function readMarks(file: File): Promise<Mark[]> {
  if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > maxUploadBytes) {
    throw new Error("Invalid file");
  }
  const data = Buffer.from(await file.arrayBuffer());
  await checkArchive(data);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(data).buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount > 1001 || sheet.columnCount > 3 ||
      sheet.getCell("A1").text !== "login" || sheet.getCell("B1").text !== "score") {
    throw new Error("Invalid sheet");
  }
  const marks: Mark[] = [];
  const seen = new Set<string>();
  for (let index = 2; index <= sheet.rowCount; index++) {
    const row = sheet.getRow(index);
    const score = row.getCell(2).value;
    if (score === null || score === "") continue;
    const value = row.getCell(1).value;
    const login = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!login || login.length > 80 || seen.has(login) ||
        typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 100) {
      throw new Error("Invalid mark");
    }
    seen.add(login);
    marks.push({ login, score });
  }
  if (!marks.length) throw new Error("Empty batch");
  return marks;
}
